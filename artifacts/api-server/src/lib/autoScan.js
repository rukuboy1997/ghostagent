/**
 * Autonomous Alpaca Options Alpha scanner.
 *
 * The scheduler only wakes once per minute. A user's configured interval controls
 * when it performs work, and Alpaca's clock prevents requests while US equities
 * are closed. The agent uses one historical-data pass per watched underlying,
 * then optionally submits one capped long-options paper order.
 */
import { and, desc, eq } from "drizzle-orm";
import { db, users, trades, watchlist } from "../db/index.js";
import { analyzeMarket } from "./cloudflare-ai.js";
import {
  chooseOptionContract,
  getAccount,
  getClock,
  getMarketDataWithIndicators,
  placeOptionsOrder,
} from "./alpaca.js";
import { emitSignalNotification } from "./notifications.js";
import { logger } from "./logger.js";

const DEDUP_WINDOW_MS = 30 * 60 * 1000;
const MIN_CONFIDENCE = 78;
const MIN_CONFLUENCE = 6;
const emitted = new Map();
let tickTimer = null;
let scanInProgress = false;

function alreadyEmitted(userId, symbol, direction) {
  const key = `${userId}:${symbol}`;
  const previous = emitted.get(key);
  if (!previous || Date.now() - previous.at > DEDUP_WINDOW_MS) return false;
  return previous.direction === direction;
}

function markEmitted(userId, symbol, direction) {
  emitted.set(`${userId}:${symbol}`, { direction, at: Date.now() });
}

function quantityFor(account, contract) {
  const premium = Number(contract?.premium || 0);
  const size = Number(contract?.contractSize || 100);
  if (!premium) return 1;
  const riskBudget = Number(account.equity || 0) * 0.01;
  return Math.min(3, Math.max(1, Math.floor(riskBudget / (premium * size))));
}

async function saveAgentTrade(user, symbol, analysis, contract, order, account, quantity) {
  const [trade] = await db.insert(trades).values({
    userId: user.id,
    symbol,
    type: analysis.decision,
    entryPrice: String(analysis.entryPrice || 0),
    stopLoss: String(analysis.stopLoss || 0),
    takeProfit: String(analysis.takeProfit || 0),
    riskRewardRatio: String(analysis.riskRewardRatio || 0),
    recommendedLotSize: String(quantity),
    riskPercent: "1",
    accountBalanceAtSignal: String(account.equity || 0),
    signalStatus: "active",
    aiReasoning: analysis.reasoning,
    aiConfidence: String(analysis.confidence),
    forecast: analysis.forecast,
    keyLevels: analysis.keyLevels,
    forecastData: {
      model: analysis.model,
      provider: analysis.provider,
      strategy: analysis.strategy,
      source: "autonomous-alpaca-agent",
      confluenceScore: analysis.confluenceScore,
      confluenceFactors: analysis.confluenceFactors,
      invalidationLevel: analysis.invalidationLevel,
      alpacaRequestId: order?._requestId || null,
    },
    alpacaOrderId: order?.id ? String(order.id) : null,
    optionSymbol: contract.symbol,
    optionType: contract.optionType,
    optionStrike: String(contract.strike),
    optionExpiration: contract.expiration ? new Date(contract.expiration) : null,
    optionPremium: contract.premium ? String(contract.premium) : null,
    confluenceScore: analysis.confluenceScore || 0,
    session: analysis.session,
  }).returning();
  await db.update(users).set({ totalTrades: (user.totalTrades || 0) + 1, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  return trade;
}

async function scanUser(user, symbols, account) {
  for (const symbol of symbols) {
    try {
      const marketData = await getMarketDataWithIndicators(symbol);
      const analysis = await analyzeMarket({ symbol, marketData, accountBalance: account.equity });
      if (analysis.decision === "HOLD" || analysis.confidence < MIN_CONFIDENCE || analysis.confluenceScore < MIN_CONFLUENCE) continue;
      if (alreadyEmitted(user.clerkId, symbol, analysis.decision)) continue;

      const contract = await chooseOptionContract(symbol, analysis.decision, marketData.price);
      analysis.optionsContract = contract;
      const quantity = quantityFor(account, contract);
      let order = null;
      let trade = null;

      if (user.autoTradeEnabled) {
        order = await placeOptionsOrder({
          symbol: contract.symbol,
          qty: quantity,
          side: "buy",
          positionIntent: "buy_to_open",
        });
        trade = await saveAgentTrade(user, symbol, analysis, contract, order, account, quantity);
      }

      markEmitted(user.clerkId, symbol, analysis.decision);
      emitSignalNotification(user.clerkId, {
        symbol,
        decision: analysis.decision,
        confidence: analysis.confidence,
        confluenceScore: analysis.confluenceScore,
        optionSymbol: contract.symbol,
        quantity,
        orderId: order?.id || null,
        tradeId: trade?.id || null,
        source: "autonomous-alpaca-agent",
        paper: true,
      });
      logger.info({
        userId: user.id,
        symbol,
        decision: analysis.decision,
        confidence: analysis.confidence,
        autoTrade: Boolean(user.autoTradeEnabled),
      }, "Autonomous Alpaca options signal processed");
    } catch (err) {
      logger.warn({ err: err.message, symbol, userId: user.id }, "Autonomous scan skipped symbol");
    }
  }
}

async function tick() {
  if (scanInProgress) return;
  scanInProgress = true;
  try {
    const clock = await getClock();
    if (!clock.is_open) return;
    const account = await getAccount();
    const eligibleUsers = await db.select().from(users).where(and(eq(users.isActive, true), eq(users.scanEnabled, true)));
    for (const user of eligibleUsers) {
      const intervalMs = (Number(user.scanIntervalMinutes) || 15) * 60 * 1000;
      const lastScan = user.lastScannedAt ? new Date(user.lastScannedAt).getTime() : 0;
      if (Date.now() - lastScan < intervalMs) continue;
      const rows = await db.select().from(watchlist)
        .where(and(eq(watchlist.userId, user.id), eq(watchlist.isActive, true)));
      const symbols = rows.map((row) => row.symbol).filter(Boolean);
      if (!symbols.length) continue;
      await db.update(users).set({
        lastScannedAt: new Date(),
        tradingBalance: String(account.equity),
        alpacaAccountId: account.id,
        alpacaAccountNumber: account.accountNumber,
        alpacaOptionsLevel: account.optionsTradingLevel,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));
      scanUser(user, symbols, account).catch((err) => logger.error({ err: err.message, userId: user.id }, "Autonomous scan failed"));
    }
  } catch (err) {
    logger.error({ err: err.message }, "Autonomous scanner tick failed");
  } finally {
    scanInProgress = false;
  }
}

export function startAutoScanner() {
  if (tickTimer) return;
  tickTimer = setInterval(tick, 60_000);
  tick().catch((err) => logger.warn({ err: err.message }, "Initial autonomous scan skipped"));
  logger.info("GhostAgent autonomous Alpaca options scanner started (tick: 60s)");
}

export function stopAutoScanner() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
}