/**
 * GhostAgent Auto-Scanner
 *
 * Cost-minimisation strategy:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. One MetaAPI connection per scan cycle per account — open, fetch ALL pairs,
 *    close immediately. Never keep a persistent connection between scans.
 * 2. Lightweight H1-only candle fetch during scanning (50 candles max).
 *    Full multi-TF fetch only happens when user manually requests a detailed signal.
 * 3. Session gating — scans only fire during London and/or NY session windows.
 *    Quiet hours (00:00–05:00 UTC, all weekend) are skipped entirely.
 * 4. Signal deduplication — if the same direction for a pair was emitted in the
 *    last 30 minutes, skip it.  Prevents notification spam.
 * 5. User-configurable interval (5 / 10 / 15 / 30 min).  Default is 15 min.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { eq, and } from "drizzle-orm";
import { db, users, watchlist, trades } from "../db/index.js";
import { analyzeMarket } from "./cloudflare-ai.js";
import { emitSignalNotification } from "./notifications.js";
import { logger } from "./logger.js";

const METAAPI_TOKEN = process.env.METAAPI_TOKEN;

// ── In-memory deduplication cache ──────────────────────────────────────────
// key: `${userId}:${symbol}` → { direction, emittedAt }
const emitCache = new Map();
const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function wasDeduplicated(userId, symbol, direction) {
  const key = `${userId}:${symbol}`;
  const last = emitCache.get(key);
  if (!last) return false;
  const expired = Date.now() - last.emittedAt > DEDUP_WINDOW_MS;
  if (expired) { emitCache.delete(key); return false; }
  return last.direction === direction;
}

function markEmitted(userId, symbol, direction) {
  emitCache.set(`${userId}:${symbol}`, { direction, emittedAt: Date.now() });
}

// ── Session helpers ─────────────────────────────────────────────────────────
function getTradingSession() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return "weekend";
  const h = now.getUTCHours();
  if (h >= 8  && h < 13) return "london";
  if (h >= 13 && h < 17) return "london_ny";
  if (h >= 17 && h < 22) return "new_york";
  if (h >= 0  && h < 5)  return "quiet";
  return "asian";
}

function shouldScanInSession(session, userFilter = "major") {
  if (session === "weekend" || session === "quiet") return false;
  if (userFilter === "major") return ["london", "london_ny", "new_york"].includes(session);
  if (userFilter === "all")   return true;
  if (userFilter === "london_only") return session === "london" || session === "london_ny";
  return true;
}

// ── Lightweight price + H1-only fetch (minimises MetaAPI usage) ─────────────
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
  return avgL === 0 ? 100 : parseFloat((100 - 100 / (1 + avgG / avgL)).toFixed(2));
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
    const e12 = calcEMA(slice, 12), e26 = calcEMA(slice, 26);
    if (e12 !== null && e26 !== null) macdSeries.push(e12 - e26);
  }
  if (macdSeries.length < 9) return null;
  const macd = macdSeries[macdSeries.length - 1];
  const signal = calcEMA(macdSeries, 9);
  return { macd: parseFloat(macd.toFixed(6)), signal: signal !== null ? parseFloat(signal.toFixed(6)) : null, hist: signal !== null ? parseFloat((macd - signal).toFixed(6)) : null };
}

function buildFallbackPrice(symbol) {
  const map = {
    EURUSD: 1.085, GBPUSD: 1.275, USDJPY: 149.5, USDCAD: 1.365,
    AUDUSD: 0.652, USDCHF: 0.898, NZDUSD: 0.599, GBPJPY: 190.8,
    EURJPY: 162.2, EURGBP: 0.851, XAUUSD: 2350, XAGUSD: 28.5,
    BTCUSD: 67000, ETHUSD: 3200,
  };
  const price = map[symbol.toUpperCase()] || 1.0;
  const spread = symbol.includes("JPY") ? 0.015 : symbol.includes("XAU") ? 0.5 : 0.00015;
  return {
    symbol, price, bid: price - spread, ask: price + spread, change: "0",
    candles: { h1: [], h4: [], d1: [] },
    rsi: { h1: null, h4: null, d1: null }, macd: { h1: null }, bb: { h1: null },
    atr: null, stoch: null, ema: { ema20: null, ema50: null, ema200: null },
    source: "fallback",
  };
}

async function fetchLightMarketData(connection, symbol) {
  try {
    const now = new Date();
    const [price, raw] = await Promise.all([
      connection.getSymbolPrice(symbol).catch(() => null),
      connection.getHistoricalCandles(symbol, "1h", new Date(now - 55 * 3600_000), now, 55).catch(() => []),
    ]);

    const candles = raw.map(c => ({
      time: c.time, open: parseFloat(c.open), high: parseFloat(c.high),
      low: parseFloat(c.low), close: parseFloat(c.close), volume: parseFloat(c.tickVolume || 0),
    })).filter(c => !isNaN(c.close));

    const closes = candles.map(c => c.close);
    const livePrice = price ? (price.bid + price.ask) / 2 : closes[closes.length - 1] || 1.0;

    return {
      symbol,
      price: livePrice, bid: price?.bid || livePrice, ask: price?.ask || livePrice,
      change: candles.length >= 2
        ? (((livePrice - candles[candles.length - 2].close) / candles[candles.length - 2].close) * 100).toFixed(4)
        : "0",
      candles: { h1: candles.slice(-15), h4: [], d1: [] },
      rsi: { h1: calcRSI(closes), h4: null, d1: null },
      macd: { h1: calcMACD(closes), h4: null },
      bb: { h1: null }, atr: null, stoch: null,
      ema: { ema20: calcEMA(closes, 20), ema50: calcEMA(closes, 50), ema200: null },
      source: "metaapi-scan",
    };
  } catch (err) {
    logger.warn({ err: err.message, symbol }, "Scan: lightweight fetch failed for symbol");
    return buildFallbackPrice(symbol);
  }
}

// ── Main per-user scan ───────────────────────────────────────────────────────
async function scanUser(user, symbols) {
  if (!symbols.length) return;

  let marketDataMap = {};

  if (METAAPI_TOKEN && user.mt5AccountId && !user.mt5AccountId.startsWith("demo-")) {
    let MetaApi;
    try {
      const mod = await import("metaapi.cloud-sdk/esm-node");
      MetaApi = mod.default || mod.MetaApi || mod;
      const api = new MetaApi(METAAPI_TOKEN);
      const account = await api.metatraderAccountApi.getAccount(user.mt5AccountId);

      // Connect once, fetch all pairs, then close immediately
      const connection = account.getRPCConnection();
      await connection.connect();
      await connection.waitSynchronized({ timeoutInSeconds: 45 });

      const results = await Promise.allSettled(
        symbols.map(sym => fetchLightMarketData(connection, sym))
      );

      // Always close regardless of errors
      await connection.close().catch(() => {});

      results.forEach((r, i) => {
        marketDataMap[symbols[i]] = r.status === "fulfilled" ? r.value : buildFallbackPrice(symbols[i]);
      });
    } catch (err) {
      logger.warn({ err: err.message, userId: user.id }, "Scan: MetaAPI connection failed, using fallback prices");
      symbols.forEach(sym => { marketDataMap[sym] = buildFallbackPrice(sym); });
    }
  } else {
    symbols.forEach(sym => { marketDataMap[sym] = buildFallbackPrice(sym); });
  }

  const tradingBal = parseFloat(user.tradingBalance || 50);

  for (const symbol of symbols) {
    try {
      const marketData = marketDataMap[symbol];
      const analysis = await analyzeMarket({ symbol, marketData, accountBalance: tradingBal });

      if (analysis.decision === "HOLD") continue;
      if (analysis.confidence < 72) continue;
      if ((analysis.confluenceScore || 0) < 6) continue;

      // Deduplication — don't spam same direction in 30-min window
      if (wasDeduplicated(user.clerkId, symbol, analysis.decision)) continue;

      markEmitted(user.clerkId, symbol, analysis.decision);

      // Emit via SSE
      emitSignalNotification(user.clerkId, {
        symbol, decision: analysis.decision, confidence: analysis.confidence,
        confluenceScore: analysis.confluenceScore, entryPrice: analysis.entryPrice,
        stopLoss: analysis.stopLoss, takeProfit: analysis.takeProfit,
        session: analysis.session, source: "watchlist-scan",
        riskRewardRatio: analysis.riskRewardRatio, riskPercent: analysis.riskPercent,
        recommendedLotSize: analysis.recommendedLotSize,
      });

      logger.info({
        userId: user.id, symbol, decision: analysis.decision,
        confidence: analysis.confidence, confluence: analysis.confluenceScore,
      }, "Auto-scan signal emitted");
    } catch (err) {
      logger.warn({ err: err.message, symbol }, "Scan: AI analysis failed for symbol");
    }
  }
}

// ── Scheduler tick ──────────────────────────────────────────────────────────
let tickTimer = null;

async function tick() {
  const session = getTradingSession();

  try {
    const allUsers = await db
      .select()
      .from(users)
      .where(and(
        eq(users.isActive, true),
        eq(users.scanEnabled, true)
      ));

    for (const user of allUsers) {
      // Session filter
      const sessionFilter = user.scanSessionFilter || "major";
      if (!shouldScanInSession(session, sessionFilter)) continue;

      // Check if enough time has elapsed since last scan
      const intervalMs = (user.scanIntervalMinutes || 15) * 60 * 1000;
      const lastScan = user.lastScannedAt ? new Date(user.lastScannedAt).getTime() : 0;
      if (Date.now() - lastScan < intervalMs) continue;

      // Minimum balance check
      if (Number(user.balance) < 10) continue;
      if ((user.tpSignalsSinceLastShare || 0) >= 3) continue; // share required

      // Fetch watchlist
      const rows = await db
        .select()
        .from(watchlist)
        .where(and(eq(watchlist.userId, user.id), eq(watchlist.isActive, true)));

      const symbols = rows.map(r => r.symbol);
      if (!symbols.length) continue;

      // Update lastScannedAt immediately to prevent double-fire
      await db
        .update(users)
        .set({ lastScannedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));

      // Scan in background (non-blocking per user)
      scanUser(user, symbols).catch(err =>
        logger.error({ err: err.message, userId: user.id }, "Scan: scanUser error")
      );
    }
  } catch (err) {
    logger.error({ err: err.message }, "Scan: tick error");
  }
}

export function startAutoScanner() {
  if (tickTimer) return;
  // Tick every 60 seconds — actual scan frequency is controlled per-user by scanIntervalMinutes
  tickTimer = setInterval(tick, 60_000);
  logger.info("GhostAgent auto-scanner started (tick: 60s)");
}

export function stopAutoScanner() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}
