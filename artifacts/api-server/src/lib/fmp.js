const FMP_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com/api/v3";

async function fmpFetch(path) {
  if (!FMP_KEY) throw new Error("FMP_API_KEY not set");
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apikey=${FMP_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP HTTP ${res.status}`);
  const data = await res.json();
  if (data?.["Error Message"] || data?.error) {
    throw new Error(data["Error Message"] || data.error);
  }
  return data;
}

function symbolToFmp(symbol) {
  const s = symbol.toUpperCase().replace("/", "");
  if (s === "BTCUSD") return { type: "crypto", fmp: "BTCUSD" };
  if (s === "ETHUSD") return { type: "crypto", fmp: "ETHUSD" };
  if (s === "XAUUSD") return { type: "commodity", fmp: "GCUSD" };
  if (s === "XAGUSD") return { type: "commodity", fmp: "SIUSD" };
  if (s.length === 6) return { type: "forex", fmp: s };
  return { type: "forex", fmp: s };
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  let avgG = gains / period, avgL = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + (d > 0 ? d : 0)) / period;
    avgL = (avgL * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
  }
  if (avgL === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgG / avgL)).toFixed(2));
}

function calcEMA(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcMACD(closes) {
  if (closes.length < 35) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (ema12 === null || ema26 === null) return null;
  const macdLine = ema12 - ema26;
  const macdValues = [];
  for (let i = 26; i < closes.length; i++) {
    const e12 = calcEMA(closes.slice(0, i), 12);
    const e26 = calcEMA(closes.slice(0, i), 26);
    if (e12 !== null && e26 !== null) macdValues.push(e12 - e26);
  }
  const signal = macdValues.length >= 9 ? calcEMA(macdValues, 9) : null;
  return {
    macd: parseFloat(macdLine.toFixed(6)),
    signal: signal !== null ? parseFloat(signal.toFixed(6)) : null,
    hist: signal !== null ? parseFloat((macdLine - signal).toFixed(6)) : null,
  };
}

async function getForexQuote(fmpSymbol) {
  const data = await fmpFetch(`/fx/${fmpSymbol}`);
  const q = Array.isArray(data) ? data[0] : data;
  if (!q || !q.ask) throw new Error(`No forex quote for ${fmpSymbol}`);
  return {
    price: parseFloat(q.ask),
    bid: parseFloat(q.bid),
    ask: parseFloat(q.ask),
    change: q.changes ? String(q.changes) : "0",
  };
}

async function getQuote(fmpSymbol) {
  const data = await fmpFetch(`/quote/${fmpSymbol}`);
  const q = Array.isArray(data) ? data[0] : data;
  if (!q || !q.price) throw new Error(`No quote for ${fmpSymbol}`);
  return {
    price: parseFloat(q.price),
    bid: parseFloat(q.price) * 0.9998,
    ask: parseFloat(q.price) * 1.0002,
    change: q.changesPercentage ? String(q.changesPercentage) : "0",
  };
}

async function getCandles(fmpSymbol, interval = "1hour") {
  try {
    const data = await fmpFetch(`/historical-chart/${interval}/${fmpSymbol}`);
    if (!Array.isArray(data) || data.length === 0) return [];
    return data
      .slice(0, 50)
      .map((c) => ({
        time: c.date,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: c.volume || 0,
      }))
      .reverse();
  } catch {
    return [];
  }
}

export async function getMarketDataWithIndicators(symbol) {
  const { type, fmp } = symbolToFmp(symbol);

  let quote;
  if (type === "forex") {
    quote = await getForexQuote(fmp);
  } else {
    quote = await getQuote(fmp);
  }

  const candles = await getCandles(fmp);
  const closes = candles.map((c) => c.close);

  const rsi = closes.length >= 15 ? calcRSI(closes) : null;
  const macd = closes.length >= 35 ? calcMACD(closes) : null;

  return {
    symbol,
    price: quote.price,
    bid: quote.bid,
    ask: quote.ask,
    change: quote.change,
    candles: candles.slice(-10),
    rsi,
    macd,
    source: "fmp",
  };
}

export function isFmpEnabled() {
  return !!FMP_KEY;
}
