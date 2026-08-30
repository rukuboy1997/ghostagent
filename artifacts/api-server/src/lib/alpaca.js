const TRADING_ENDPOINT = (process.env.ALPACA_API_ENDPOINT || "https://paper-api.alpaca.markets/v2").replace(/\/$/, "");
const DATA_ENDPOINT = (process.env.ALPACA_DATA_ENDPOINT || "https://data.alpaca.markets").replace(/\/$/, "");
const API_KEY = process.env.ALPACA_API_KEY;
const API_SECRET = process.env.ALPACA_API_SECRET;

function assertConfigured() {
  if (!API_KEY || !API_SECRET) {
    throw new Error("Alpaca paper-trading credentials are not configured");
  }
}

function authHeaders() {
  assertConfigured();
  return {
    "APCA-API-KEY-ID": API_KEY,
    "APCA-API-SECRET-KEY": API_SECRET,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const requestId = response.headers.get("x-request-id");
  const bodyText = await response.text();
  let body;
  try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = { message: bodyText }; }
  if (!response.ok) {
    const message = body?.message || body?.error || `Alpaca API error (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.requestId = requestId;
    throw error;
  }
  return { ...body, _requestId: requestId };
}

function calculateRsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    averageGain = ((averageGain * (period - 1)) + Math.max(delta, 0)) / period;
    averageLoss = ((averageLoss * (period - 1)) + Math.max(-delta, 0)) / period;
  }
  if (averageLoss === 0) return 100;
  return Number((100 - (100 / (1 + averageGain / averageLoss))).toFixed(2));
}

function calculateEma(values, period) {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let i = period; i < values.length; i += 1) {
    ema = ((values[i] - ema) * multiplier) + ema;
  }
  return Number(ema.toFixed(4));
}

function calculateMacd(closes) {
  if (closes.length < 35) return null;
  const series = [];
  for (let i = 26; i <= closes.length; i += 1) {
    const slice = closes.slice(0, i);
    series.push((calculateEma(slice, 12) || 0) - (calculateEma(slice, 26) || 0));
  }
  const signal = calculateEma(series, 9);
  const macd = series[series.length - 1];
  return {
    macd: Number(macd.toFixed(4)),
    signal: signal === null ? null : Number(signal.toFixed(4)),
    histogram: signal === null ? null : Number((macd - signal).toFixed(4)),
  };
}

function normalizeBar(bar) {
  return {
    time: bar.t,
    open: Number(bar.o),
    high: Number(bar.h),
    low: Number(bar.l),
    close: Number(bar.c),
    volume: Number(bar.v || 0),
    vwap: Number(bar.vw || 0),
  };
}

function sessionName() {
  const hour = new Date().getUTCHours();
  if (hour >= 13 && hour < 17) return "US open";
  if (hour >= 17 && hour < 21) return "US afternoon";
  if (hour >= 12 && hour < 13) return "pre-market";
  return "off-hours";
}

export async function getAccount() {
  const account = await request(TRADING_ENDPOINT, "/account");
  return {
    id: account.id,
    accountNumber: account.account_number,
    status: account.status,
    currency: account.currency || "USD",
    cash: Number(account.cash || 0),
    buyingPower: Number(account.buying_power || 0),
    equity: Number(account.equity || 0),
    lastEquity: Number(account.last_equity || 0),
    optionsApprovedLevel: account.options_approved_level ?? null,
    optionsTradingLevel: account.options_trading_level ?? null,
    paper: Boolean(account.account_number),
    connected: true,
    source: "alpaca-trading-api",
  };
}

export async function getClock() {
  return request(TRADING_ENDPOINT, "/clock");
}

export async function getOpenPositions() {
  const positions = await request(TRADING_ENDPOINT, "/positions");
  return Array.isArray(positions) ? positions : [];
}

export async function getOrders(status = "open") {
  const orders = await request(TRADING_ENDPOINT, `/orders?status=${encodeURIComponent(status)}&limit=100&nested=true`);
  return Array.isArray(orders) ? orders : [];
}

export async function getHistoricalBars(symbol, timeframe = "1Hour", limit = 200) {
  const end = new Date();
  const start = new Date(end.getTime() - (limit * 60 * 60 * 1000 * (timeframe === "1Day" ? 24 : 1)));
  const query = new URLSearchParams({
    timeframe,
    start: start.toISOString(),
    end: end.toISOString(),
    limit: String(limit),
    adjustment: "raw",
    feed: "iex",
    sort: "asc",
  });
  const result = await request(DATA_ENDPOINT, `/v2/stocks/${encodeURIComponent(symbol)}/bars?${query}`);
  return (result.bars || []).map(normalizeBar).filter((bar) => Number.isFinite(bar.close));
}

export async function getLatestTrade(symbol) {
  const result = await request(DATA_ENDPOINT, `/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=iex`);
  return result.trade ? { price: Number(result.trade.p), timestamp: result.trade.t } : null;
}

export async function getMarketDataWithIndicators(symbol) {
  const [hourly, daily, latest] = await Promise.all([
    getHistoricalBars(symbol, "1Hour", 200),
    getHistoricalBars(symbol, "1Day", 120),
    getLatestTrade(symbol).catch(() => null),
  ]);
  const price = latest?.price || hourly.at(-1)?.close || daily.at(-1)?.close || 0;
  const hourlyCloses = hourly.map((bar) => bar.close);
  const dailyCloses = daily.map((bar) => bar.close);
  const change = hourlyCloses.length > 1
    ? ((price - hourlyCloses.at(-2)) / hourlyCloses.at(-2)) * 100
    : 0;
  const ema20 = calculateEma(hourlyCloses, 20);
  const ema50 = calculateEma(hourlyCloses, 50);
  const ema200 = calculateEma(hourlyCloses, 200);
  return {
    symbol,
    price,
    bid: price,
    ask: price,
    change: Number(change.toFixed(3)),
    candles: { h1: hourly.slice(-30), d1: daily.slice(-30) },
    rsi: { h1: calculateRsi(hourlyCloses), d1: calculateRsi(dailyCloses) },
    macd: { h1: calculateMacd(hourlyCloses), d1: calculateMacd(dailyCloses) },
    ema: { ema20, ema50, ema200 },
    atr: hourly.length >= 15
      ? Number((hourly.slice(-14).reduce((sum, bar) => sum + (bar.high - bar.low), 0) / 14).toFixed(4))
      : null,
    session: sessionName(),
    source: "alpaca-historical-data",
    dataFeed: "IEX",
    fetchedAt: new Date().toISOString(),
  };
}

export async function getOptionContracts(underlying) {
  const now = new Date();
  const start = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
  const end = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000));
  const query = new URLSearchParams({
    underlying_symbols: underlying,
    status: "active",
    expiration_date_gte: start.toISOString().slice(0, 10),
    expiration_date_lte: end.toISOString().slice(0, 10),
    limit: "1000",
  });
  const result = await request(TRADING_ENDPOINT, `/options/contracts?${query}`);
  return result.option_contracts || result.contracts || [];
}

export async function getOptionSnapshot(symbol) {
  try {
    const result = await request(DATA_ENDPOINT, `/v1beta1/options/snapshots/${encodeURIComponent(symbol)}?feed=indicative`);
    const snapshot = result[symbol] || result;
    const bid = Number(snapshot?.latestQuote?.bp || snapshot?.latestQuote?.bid_price || 0);
    const ask = Number(snapshot?.latestQuote?.ap || snapshot?.latestQuote?.ask_price || 0);
    return {
      bid,
      ask,
      mid: bid && ask ? Number(((bid + ask) / 2).toFixed(2)) : 0,
      impliedVolatility: Number(snapshot?.impliedVolatility || 0),
      delta: Number(snapshot?.greeks?.delta || 0),
    };
  } catch {
    return null;
  }
}

export async function chooseOptionContract(underlying, decision, underlyingPrice) {
  const contracts = await getOptionContracts(underlying);
  const optionType = decision === "BUY_PUT" ? "put" : "call";
  const eligible = contracts
    .filter((contract) => (contract.type || contract.option_type) === optionType)
    .filter((contract) => contract.tradable !== false)
    .sort((a, b) => {
      const aDistance = Math.abs(Number(a.strike_price) - underlyingPrice);
      const bDistance = Math.abs(Number(b.strike_price) - underlyingPrice);
      return aDistance - bDistance || String(a.expiration_date).localeCompare(String(b.expiration_date));
    });
  const contract = eligible[0];
  if (!contract) throw new Error(`No tradable ${optionType} contract found for ${underlying}`);
  const snapshot = await getOptionSnapshot(contract.symbol);
  return {
    symbol: contract.symbol,
    underlying,
    optionType,
    strike: Number(contract.strike_price),
    expiration: contract.expiration_date,
    contractSize: Number(contract.size || 100),
    premium: snapshot?.mid || 0,
    delta: snapshot?.delta || 0,
    snapshot,
    source: "alpaca-options-api",
  };
}

export async function placeOptionsOrder({ symbol, qty = 1, side = "buy", positionIntent = "buy_to_open" }) {
  return request(TRADING_ENDPOINT, "/orders", {
    method: "POST",
    body: JSON.stringify({
      symbol,
      qty: String(Math.max(1, Math.floor(qty))),
      side,
      type: "market",
      time_in_force: "day",
      position_intent: positionIntent,
      client_order_id: `ghostagent-${Date.now()}`,
    }),
  });
}

export function isAlpacaConfigured() {
  return Boolean(API_KEY && API_SECRET);
}

export function alpacaConfigSummary() {
  return {
    configured: isAlpacaConfigured(),
    paperEndpoint: TRADING_ENDPOINT.includes("paper-api"),
    tradingApi: "Alpaca Trading API v2",
    marketDataApi: "Alpaca Market Data API",
    optionsApi: "Alpaca Options Contracts + Market Data",
  };
}