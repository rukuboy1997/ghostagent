const METAAPI_TOKEN = process.env.METAAPI_TOKEN;

let _MetaApi = null;
let _api = null;

async function getApi() {
  if (_api) return _api;
  if (!METAAPI_TOKEN) throw new Error("METAAPI_TOKEN is not configured");
  if (!_MetaApi) {
    const mod = await import("metaapi.cloud-sdk/esm-node");
    _MetaApi = mod.default || mod.MetaApi || mod;
  }
  _api = new _MetaApi(METAAPI_TOKEN);
  return _api;
}

export async function connectAccount(mt5Login, mt5Password, mt5Server) {
  const api = await getApi();
  try {
    const { items } = await api.metatraderAccountApi.getAccountsWithInfiniteScrollPagination({ limit: 100 });
    const existing = items?.find(
      (a) => String(a.login) === String(mt5Login) && a.server === mt5Server
    );
    if (existing) {
      if (existing.state === "UNDEPLOYED") existing.deploy().catch(() => {});
      return { accountId: existing.id, alreadyExisted: true, state: existing.state, connectionStatus: existing.connectionStatus };
    }
  } catch (_) {}

  const account = await api.metatraderAccountApi.createAccount({
    name: `GhostAgent-${mt5Login}`,
    type: "cloud",
    login: String(mt5Login),
    password: mt5Password,
    server: mt5Server,
    platform: "mt5",
    magic: 123456,
    reliability: "regular",
  });
  account.deploy().catch(() => {});
  return { accountId: account.id, alreadyExisted: false, state: "DEPLOYING" };
}

export async function getAccountStatus(mt5AccountId) {
  const res = await fetch(
    `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${mt5AccountId}`,
    { headers: { "auth-token": METAAPI_TOKEN } }
  );
  if (!res.ok) throw new Error(`MetaAPI status check failed: ${res.status}`);
  const a = await res.json();
  return { state: a.state, connectionStatus: a.connectionStatus, server: a.server, login: a.login };
}

export async function getAccountInfo(mt5AccountId) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized({ timeoutInSeconds: 60 });
  const info = await connection.getAccountInformation();
  await connection.close();
  return info;
}

export async function getMarketData(mt5AccountId, symbol) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized({ timeoutInSeconds: 60 });
  try {
    const price = await connection.getSymbolPrice(symbol);
    const candles = await connection
      .getHistoricalCandles(symbol, "1h", new Date(Date.now() - 5 * 3600 * 1000), new Date(), 5)
      .catch(() => []);
    await connection.close();
    return {
      symbol, bid: price.bid, ask: price.ask,
      currentPrice: ((price.bid + price.ask) / 2).toFixed(5),
      change: null, candles: candles.slice(-5),
    };
  } catch (err) {
    await connection.close();
    throw err;
  }
}

// ─── Multi-timeframe market data with indicators ───────────────────────────────
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
  return {
    upper: parseFloat((mid + multiplier * stdDev).toFixed(6)),
    mid: parseFloat(mid.toFixed(6)),
    lower: parseFloat((mid - multiplier * stdDev).toFixed(6)),
    width: parseFloat((2 * multiplier * stdDev).toFixed(6)),
  };
}

function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trues = [];
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i];
    const prevClose = candles[i - 1].close;
    trues.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  if (trues.length < period) return null;
  let atr = trues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trues.length; i++) atr = (atr * (period - 1) + trues[i]) / period;
  return parseFloat(atr.toFixed(6));
}

function calcStochastic(candles, kPeriod = 14, dPeriod = 3) {
  if (candles.length < kPeriod) return null;
  const kValues = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const close = candles[i].close;
    kValues.push(high === low ? 50 : ((close - low) / (high - low)) * 100);
  }
  const k = parseFloat(kValues[kValues.length - 1].toFixed(2));
  const d = kValues.length >= dPeriod
    ? parseFloat((kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod).toFixed(2)) : k;
  return { k, d };
}

function normalizeCandle(c) {
  return {
    time: c.time || c.brokerTime || c.startBrokerTime,
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
    volume: parseFloat(c.tickVolume || c.volume || 0),
  };
}

export async function getMarketDataWithIndicators(mt5AccountId, symbol) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized({ timeoutInSeconds: 60 });

  let price, h1Candles = [], h4Candles = [], d1Candles = [];

  try {
    price = await connection.getSymbolPrice(symbol);

    const now = new Date();
    const [h1Raw, h4Raw, d1Raw] = await Promise.all([
      connection.getHistoricalCandles(symbol, "1h", new Date(now - 100 * 3600 * 1000), now, 100).catch(() => []),
      connection.getHistoricalCandles(symbol, "4h", new Date(now - 50 * 4 * 3600 * 1000), now, 50).catch(() => []),
      connection.getHistoricalCandles(symbol, "1d", new Date(now - 30 * 24 * 3600 * 1000), now, 30).catch(() => []),
    ]);
    h1Candles = h1Raw.map(normalizeCandle).filter(c => !isNaN(c.close));
    h4Candles = h4Raw.map(normalizeCandle).filter(c => !isNaN(c.close));
    d1Candles = d1Raw.map(normalizeCandle).filter(c => !isNaN(c.close));
  } finally {
    await connection.close().catch(() => {});
  }

  const livePrice = price ? (price.bid + price.ask) / 2 : (h1Candles[h1Candles.length - 1]?.close || 0);
  const h1Closes = h1Candles.map(c => c.close);
  const h4Closes = h4Candles.map(c => c.close);
  const d1Closes = d1Candles.map(c => c.close);

  return {
    symbol,
    price: livePrice,
    bid: price?.bid || livePrice,
    ask: price?.ask || livePrice,
    change: h1Candles.length >= 2
      ? (((livePrice - h1Candles[h1Candles.length - 2].close) / h1Candles[h1Candles.length - 2].close) * 100).toFixed(4)
      : "0",
    candles: {
      h1: h1Candles.slice(-15),
      h4: h4Candles.slice(-8),
      d1: d1Candles.slice(-7),
    },
    rsi: {
      h1: calcRSI(h1Closes),
      h4: h4Closes.length ? calcRSI(h4Closes) : null,
      d1: d1Closes.length ? calcRSI(d1Closes) : null,
    },
    macd: {
      h1: calcMACD(h1Closes),
      h4: h4Closes.length ? calcMACD(h4Closes) : null,
    },
    bb: { h1: calcBollingerBands(h1Closes) },
    atr: calcATR(h1Candles),
    stoch: calcStochastic(h1Candles),
    ema: {
      ema20: calcEMA(h1Closes, 20),
      ema50: calcEMA(h1Closes, 50),
      ema200: h1Closes.length >= 200 ? calcEMA(h1Closes, 200) : null,
    },
    source: "metaapi",
  };
}

export async function placeTrade(mt5AccountId, { symbol, type, volume, stopLoss, takeProfit }) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized({ timeoutInSeconds: 60 });
  try {
    let result;
    if (type === "BUY") {
      result = await connection.createMarketBuyOrder(symbol, volume, stopLoss, takeProfit, { comment: "GhostAgent" });
    } else if (type === "SELL") {
      result = await connection.createMarketSellOrder(symbol, volume, stopLoss, takeProfit, { comment: "GhostAgent" });
    } else {
      throw new Error("Invalid trade type");
    }
    await connection.close();
    return result;
  } catch (err) {
    await connection.close();
    throw err;
  }
}

export async function getOpenTrades(mt5AccountId) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized({ timeoutInSeconds: 60 });
  const positions = await connection.getPositions();
  await connection.close();
  return positions;
}

export async function closePosition(mt5AccountId, positionId) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized({ timeoutInSeconds: 60 });
  const result = await connection.closePosition(positionId, { comment: "GhostAgent-close" });
  await connection.close();
  return result;
}

export function isMetaApiEnabled() {
  return !!METAAPI_TOKEN;
}
