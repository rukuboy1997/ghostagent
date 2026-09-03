// Reuse existing alpaca.js functions; no external SDK import
import { getOptionContracts as getAlpacaOptionContracts, getOptionSnapshot } from './alpaca.js';
import 'dotenv/config';

// Use same env variables as in alpaca.js
const TRADING_ENDPOINT = (process.env.ALPACA_API_ENDPOINT || "https://paper-api.alpaca.markets/v2").replace(/\/$/, "");
const API_KEY = process.env.ALPACA_API_KEY;
const API_SECRET = process.env.ALPACA_API_SECRET;

function authHeaders() {
  return {
    "APCA-API-KEY-ID": API_KEY,
    "APCA-API-SECRET-KEY": API_SECRET,
    "Content-Type": "application/json",
  };
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const bodyText = await response.text();
  let body;
  try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = { message: bodyText }; }
  if (!response.ok) {
    const message = body?.message || body?.error || `Alpaca API error (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body;
}

// ----- Exported functions for the wheel strategy -----

// Get option contracts with expiration filtering (only puts, 20-50 days)
export const getOptionContracts = async (symbol, minDaysOut = 20, maxDaysOut = 50) => {
  const contracts = await getAlpacaOptionContracts(symbol);
  const now = new Date();
  return contracts
    .filter(c => {
      const daysToExp = (new Date(c.expiration_date) - now) / (1000 * 60 * 60 * 24);
      return daysToExp >= minDaysOut && daysToExp <= maxDaysOut && c.type === 'put' && c.tradable !== false;
    })
    .map(c => {
      const daysToExp = (new Date(c.expiration_date) - now) / (1000 * 60 * 60 * 24);
      return { ...c, daysToExp };
    });
};

// Get option quotes (bid/ask) for multiple symbols
export const getOptionQuotes = async (symbols) => {
  const result = {};
  await Promise.all(symbols.map(async (sym) => {
    const snap = await getOptionSnapshot(sym);
    if (snap) result[sym] = snap;
  }));
  return result;
};

// Place a limit order for options (single leg)
export const placeOptionOrder = async (params) => {
  // params: { symbol, side, qty, limit_price, time_in_force }
  const orderData = {
    symbol: params.symbol,
    side: params.side,
    qty: String(params.qty || 1),
    type: 'limit',
    limit_price: String(params.limit_price),
    time_in_force: params.time_in_force || 'day',
    order_class: 'simple',
  };
  return request(TRADING_ENDPOINT, '/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
};

// Get open options positions (filter asset_class)
export const getOptionPositions = async () => {
  const positions = await request(TRADING_ENDPOINT, '/positions');
  return positions.filter(p => p.asset_class === 'option');
};
