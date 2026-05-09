const TD_KEY = process.env.TWELVE_DATA_API_KEY;
const BASE = "https://api.twelvedata.com";

function toTdSymbol(symbol) {
  const s = symbol.toUpperCase().replace("/", "");
  const map = {
    EURUSD: "EUR/USD", GBPUSD: "GBP/USD", USDJPY: "USD/JPY",
    USDCAD: "USD/CAD", AUDUSD: "AUD/USD", USDCHF: "USD/CHF",
    NZDUSD: "NZD/USD", GBPJPY: "GBP/JPY", EURJPY: "EUR/JPY",
    EURGBP: "EUR/GBP", GBPAUD: "GBP/AUD", GBPCAD: "GBP/CAD",
    CADJPY: "CAD/JPY", AUDCAD: "AUD/CAD", EURAUD: "EUR/AUD",
    XAUUSD: "XAU/USD", XAGUSD: "XAG/USD",
    BTCUSD: "BTC/USD", ETHUSD: "ETH/USD",
  };
  return map[s] || symbol;
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
  return parseFloat(ema.toFixed(6));
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

function calcBollingerBands(closes, period = 20, multiplier = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mid, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = mid + multiplier * stdDev;
  const lower = mid - multiplier * stdDev;
  return {
    upper: parseFloat(upper.toFixed(6)),
    mid: parseFloat(mid.toFixed(6)),
    lower: parseFloat(lower.toFixed(6)),
    width: parseFloat((upper - lower).toFixed(6)),
  };
}

function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trues = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    trues.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  if (trues.length < period) return null;
  let atr = trues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trues.length; i++) {
    atr = (atr * (period - 1) + trues[i]) / period;
  }
  return parseFloat(atr.toFixed(6));
}

function calcStochastic(candles, kPeriod = 14, dPeriod = 3) {
  if (candles.length < kPeriod) return null;
  const kValues = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map((c) => c.high));
    const low = Math.min(...slice.map((c) => c.low));
    const close = candles[i].close;
    if (high === low) { kValues.push(50); continue; }
    kValues.push(((close - low) / (high - low)) * 100);
  }
  const k = parseFloat(kValues[kValues.length - 1].toFixed(2));
  const d = kValues.length >= dPeriod
    ? parseFloat((kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod).toFixed(2))
    : k;
  return { k, d };
}

function parseSeries(series) {
  if (!series?.values?.length) return [];
  return series.values
    .map((c) => ({
      time: c.datetime,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume || 0),
    }))
    .reverse();
}

export async function getMarketDataWithIndicators(symbol) {
  const td = toTdSymbol(symbol);

  let h1Series, h4Series, d1Series;

  try {
    [h1Series, h4Series, d1Series] = await Promise.all([
      tdFetch("/time_series", { symbol: td, interval: "1h", outputsize: 100, order: "DESC" }),
      tdFetch("/time_series", { symbol: td, interval: "4h", outputsize: 50, order: "DESC" }),
      tdFetch("/time_series", { symbol: td, interval: "1day", outputsize: 30, order: "DESC" }),
    ]);
  } catch (e) {
    h1Series = await tdFetch("/time_series", { symbol: td, interval: "1h", outputsize: 52, order: "DESC" });
    h4Series = null;
    d1Series = null;
  }

  const h1Candles = parseSeries(h1Series);
  const h4Candles = h4Series ? parseSeries(h4Series) : [];
  const d1Candles = d1Series ? parseSeries(d1Series) : [];

  if (!h1Candles.length) throw new Error(`No candle data returned for ${symbol}`);

  const h1Closes = h1Candles.map((c) => c.close);
  const h4Closes = h4Candles.map((c) => c.close);
  const d1Closes = d1Candles.map((c) => c.close);

  const latest = h1Candles[h1Candles.length - 1];
  const prev = h1Candles[h1Candles.length - 2];
  const price = latest.close;
  const change = prev ? (((price - prev.close) / prev.close) * 100).toFixed(4) : "0";

  const rsiH1 = calcRSI(h1Closes);
  const rsiH4 = h4Closes.length ? calcRSI(h4Closes) : null;
  const rsiD1 = d1Closes.length ? calcRSI(d1Closes) : null;

  const macdH1 = calcMACD(h1Closes);
  const macdH4 = h4Closes.length ? calcMACD(h4Closes) : null;

  const bbH1 = calcBollingerBands(h1Closes);
  const atrH1 = calcATR(h1Candles);
  const stochH1 = calcStochastic(h1Candles);

  const ema20 = calcEMA(h1Closes, 20);
  const ema50 = calcEMA(h1Closes, 50);
  const ema200 = h1Closes.length >= 200 ? calcEMA(h1Closes, 200) : null;

  return {
    symbol,
    price,
    bid: price,
    ask: price,
    change,
    candles: {
      h1: h1Candles.slice(-15),
      h4: h4Candles.slice(-8),
      d1: d1Candles.slice(-7),
    },
    rsi: { h1: rsiH1, h4: rsiH4, d1: rsiD1 },
    macd: { h1: macdH1, h4: macdH4 },
    bb: { h1: bbH1 },
    atr: atrH1,
    stoch: stochH1,
    ema: { ema20, ema50, ema200 },
    source: "twelvedata-multi-tf",
  };
}

export function isTwelveDataEnabled() {
  return !!TD_KEY;
}
