const AV_KEY = process.env.ALPHA_VANTAGE_KEY;
const BASE = "https://www.alphavantage.co/query";

function parseSymbol(symbol) {
  const s = symbol.toUpperCase().replace("/", "");
  if (s === "BTCUSD") return { type: "crypto", from: "BTC", to: "USD" };
  if (s === "ETHUSD") return { type: "crypto", from: "ETH", to: "USD" };
  if (s === "XAUUSD") return { type: "forex", from: "XAU", to: "USD" };
  if (s === "XAGUSD") return { type: "forex", from: "XAG", to: "USD" };
  if (s === "USOIL" || s === "WTI") return { type: "commodity", ticker: "WTI" };
  if (s === "BRENT") return { type: "commodity", ticker: "BRENT" };
  if (s.length === 6) return { type: "forex", from: s.slice(0, 3), to: s.slice(3) };
  return { type: "forex", from: s.slice(0, 3), to: s.slice(3) };
}

async function avFetch(params) {
  if (!AV_KEY) throw new Error("ALPHA_VANTAGE_KEY not set");
  const url = new URL(BASE);
  url.searchParams.set("apikey", AV_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const data = await res.json();
  if (data["Note"] || data["Information"]) {
    throw new Error("Alpha Vantage rate limit reached. Try again in a minute.");
  }
  return data;
}

async function getForexRate(from, to) {
  const data = await avFetch({ function: "CURRENCY_EXCHANGE_RATE", from_currency: from, to_currency: to });
  const rate = data["Realtime Currency Exchange Rate"];
  if (!rate) throw new Error("No exchange rate data");
  return {
    bid: parseFloat(rate["8. Bid Price"] || rate["5. Exchange Rate"]),
    ask: parseFloat(rate["9. Ask Price"] || rate["5. Exchange Rate"]),
    price: parseFloat(rate["5. Exchange Rate"]),
    lastRefreshed: rate["6. Last Refreshed"],
  };
}

async function getForexIntraday(from, to) {
  try {
    const data = await avFetch({ function: "FX_INTRADAY", from_symbol: from, to_symbol: to, interval: "60min", outputsize: "compact" });
    const series = data["Time Series FX (60min)"];
    if (!series) return [];
    return Object.entries(series)
      .slice(0, 10)
      .map(([time, v]) => ({
        time,
        open: parseFloat(v["1. open"]),
        high: parseFloat(v["2. high"]),
        low: parseFloat(v["3. low"]),
        close: parseFloat(v["4. close"]),
      }))
      .reverse();
  } catch {
    return [];
  }
}

async function getRSI(from, to) {
  try {
    const data = await avFetch({
      function: "RSI",
      symbol: `${from}${to}`,
      interval: "60min",
      time_period: 14,
      series_type: "close",
    });
    const series = data["Technical Analysis: RSI"];
    if (!series) return null;
    const latest = Object.values(series)[0];
    return parseFloat(latest?.RSI);
  } catch {
    return null;
  }
}

async function getMACDSignal(from, to) {
  try {
    const data = await avFetch({
      function: "MACD",
      symbol: `${from}${to}`,
      interval: "60min",
      series_type: "close",
    });
    const series = data["Technical Analysis: MACD"];
    if (!series) return null;
    const latest = Object.values(series)[0];
    return {
      macd: parseFloat(latest?.MACD),
      signal: parseFloat(latest?.MACD_Signal),
      hist: parseFloat(latest?.MACD_Hist),
    };
  } catch {
    return null;
  }
}

export async function getMarketData(symbol) {
  const parsed = parseSymbol(symbol);

  if (parsed.type === "commodity") {
    return getCommodityData(parsed.ticker, symbol);
  }

  const { from, to } = parsed;

  const [rateData, candles] = await Promise.all([
    getForexRate(from, to),
    getForexIntraday(from, to),
  ]);

  const spread = rateData.ask - rateData.bid;
  const prevClose = candles.length > 1 ? candles[candles.length - 2].close : rateData.price;
  const change = prevClose ? (((rateData.price - prevClose) / prevClose) * 100).toFixed(4) : "0";

  return {
    symbol,
    from,
    to,
    price: rateData.price,
    bid: rateData.bid,
    ask: rateData.ask,
    spread: spread.toFixed(5),
    change,
    candles,
    lastRefreshed: rateData.lastRefreshed,
    source: "alphavantage",
  };
}

async function getCommodityData(ticker, symbol) {
  try {
    const data = await avFetch({ function: ticker });
    const series = data?.data;
    if (!series || !series.length) throw new Error("No commodity data");
    const latest = series[0];
    const prev = series[1];
    const price = parseFloat(latest.value);
    const prevPrice = prev ? parseFloat(prev.value) : price;
    const change = (((price - prevPrice) / prevPrice) * 100).toFixed(4);
    const candles = series.slice(0, 10).map((d) => ({
      time: d.date,
      close: parseFloat(d.value),
      open: parseFloat(d.value),
      high: parseFloat(d.value) * 1.001,
      low: parseFloat(d.value) * 0.999,
    })).reverse();

    return {
      symbol,
      price,
      bid: price * 0.9998,
      ask: price * 1.0002,
      change,
      candles,
      source: "alphavantage",
    };
  } catch {
    throw new Error(`Failed to fetch commodity data for ${symbol}`);
  }
}

export async function getMarketDataWithIndicators(symbol) {
  const parsed = parseSymbol(symbol);
  if (parsed.type === "commodity") {
    const base = await getCommodityData(parsed.ticker, symbol);
    return { ...base, rsi: null, macd: null };
  }

  const { from, to } = parsed;
  const [base, rsi, macd] = await Promise.all([
    getMarketData(symbol),
    getRSI(from, to).catch(() => null),
    getMACDSignal(from, to).catch(() => null),
  ]);

  return { ...base, rsi, macd };
}

export function isAlphaVantageEnabled() {
  return !!AV_KEY;
}
