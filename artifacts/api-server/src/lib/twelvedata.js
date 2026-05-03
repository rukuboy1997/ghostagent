const TD_KEY = process.env.TWELVE_DATA_API_KEY;
const BASE = "https://api.twelvedata.com";

function toTdSymbol(symbol) {
  const s = symbol.toUpperCase().replace("/", "");
  if (s === "EURUSD") return "EUR/USD";
  if (s === "GBPUSD") return "GBP/USD";
  if (s === "USDJPY") return "USD/JPY";
  if (s === "USDCAD") return "USD/CAD";
  if (s === "AUDUSD") return "AUD/USD";
  if (s === "USDCHF") return "USD/CHF";
  if (s === "NZDUSD") return "NZD/USD";
  if (s === "GBPJPY") return "GBP/JPY";
  if (s === "EURJPY") return "EUR/JPY";
  if (s === "XAUUSD") return "XAU/USD";
  if (s === "XAGUSD") return "XAG/USD";
  if (s === "BTCUSD") return "BTC/USD";
  if (s === "ETHUSD") return "ETH/USD";
  return symbol;
}

async function tdFetch(path, params = {}) {
  if (!TD_KEY) throw new Error("TWELVE_DATA_API_KEY not set");
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apikey", TD_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === "error") throw new Error(`Twelve Data: ${data.message}`);
  return data;
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
  for (let i = period; i < values.length; i++) ema = values[i] * k + ema * (1 - k);
  return ema;
}

function calcMACD(closes) {
  if (closes.length < 35) return null;
  const macdSeries = [];
  for (let i = 26; i <= closes.length; i++) {
    const slice = closes.slice(0, i);
    const e12 = calcEMA(slice, 12);
    const e26 = calcEMA(slice, 26);
    if (e12 !== null && e26 !== null) macdSeries.push(e12 - e26);
  }
  if (macdSeries.length < 9) return null;
  const macdLine = macdSeries[macdSeries.length - 1];
  const signal = calcEMA(macdSeries, 9);
  return {
    macd: parseFloat(macdLine.toFixed(6)),
    signal: signal !== null ? parseFloat(signal.toFixed(6)) : null,
    hist: signal !== null ? parseFloat((macdLine - signal).toFixed(6)) : null,
  };
}

export async function getMarketDataWithIndicators(symbol) {
  const td = toTdSymbol(symbol);

  const series = await tdFetch("/time_series", {
    symbol: td,
    interval: "1h",
    outputsize: 52,
    order: "ASC",
  });

  if (!series.values || !series.values.length) {
    throw new Error(`No candle data returned for ${symbol}`);
  }

  const candles = series.values.map((c) => ({
    time: c.datetime,
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
    volume: parseFloat(c.volume || 0),
  }));

  const closes = candles.map((c) => c.close);
  const latest = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const price = latest.close;
  const change = prev ? (((price - prev.close) / prev.close) * 100).toFixed(4) : "0";

  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);

  return {
    symbol,
    price,
    bid: price,
    ask: price,
    change,
    candles: candles.slice(-10),
    rsi,
    macd,
    source: "twelvedata",
  };
}

export function isTwelveDataEnabled() {
  return !!TD_KEY;
}
