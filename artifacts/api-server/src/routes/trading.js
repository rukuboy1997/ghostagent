import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { eq, desc } from "drizzle-orm";
import { db, users, trades } from "../db/index.js";
import { analyzeMarket } from "../lib/cloudflare-ai.js";
import {
  chooseOptionContract,
  getAccount,
  getMarketDataWithIndicators,
  getOpenPositions,
  placeOptionsOrder,
} from "../lib/alpaca.js";
import { emitSignalNotification } from "../lib/notifications.js";

const router = Router();
const MIN_CONFIDENCE = 78;
const MIN_CONFLUENCE = 6;
const MAX_RISK_PERCENT = 1;

async function getUser(clerkId) {
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  return user;
}

function validateAnalysis(analysis) {
  if (!analysis || !["BUY_CALL", "BUY_PUT"].includes(analysis.decision)) {
    return "GhostAgent is holding because no options setup qualified.";
  }
  if (Number(analysis.confidence) < MIN_CONFIDENCE) {
    return `Confidence (${analysis.confidence}%) is below the ${MIN_CONFIDENCE}% execution gate.`;
  }
  if (Number(analysis.confluenceScore) < MIN_CONFLUENCE) {
    return `Confluence (${analysis.confluenceScore}/8) is below the ${MIN_CONFLUENCE}/8 execution gate.`;
  }
  return null;
}

function calculateQty(account, contract) {
  const premium = Number(contract?.premium || 0);
  const contractSize = Number(contract?.contractSize || 100);
  if (!premium) return 1;
  const riskBudget = Number(account.equity || account.buyingPower || 100000) * (MAX_RISK_PERCENT / 100);
  return Math.min(3, Math.max(1, Math.floor(riskBudget / (premium * contractSize))));
}

router.post("/analyze", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const symbol = String(req.body.symbol || "").toUpperCase();
    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    const user = await getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const account = await getAccount();
    const accountBalance = Number(req.body.accountBalance) || account.equity;
    if (!accountBalance || accountBalance < 1000) {
      return res.status(400).json({ error: "Alpaca paper account equity must be at least $1,000." });
    }

    const marketData = await getMarketDataWithIndicators(symbol);
    const analysis = await analyzeMarket({ symbol, marketData, accountBalance });
    let optionsContract = null;
    if (analysis.decision !== "HOLD") {
      optionsContract = await chooseOptionContract(symbol, analysis.decision, marketData.price);
      analysis.optionsContract = optionsContract;
      analysis.recommendedQty = calculateQty(account, optionsContract);
    }

    if (analysis.decision !== "HOLD" && analysis.confidence >= MIN_CONFIDENCE) {
      emitSignalNotification(userId, {
        symbol,
        decision: analysis.decision,
        confidence: analysis.confidence,
        confluenceScore: analysis.confluenceScore,
        optionSymbol: optionsContract?.symbol,
        source: "alpaca-options-agent",
      });
    }

    await db.update(users).set({
      tradingBalance: String(account.equity),
      alpacaAccountId: account.id,
      alpacaAccountNumber: account.accountNumber,
      alpacaOptionsLevel: account.optionsTradingLevel,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    res.json({ analysis, marketData, account, optionsContract });
  } catch (err) {
    req.log.error({ err }, "Options analysis failed");
    res.status(err.status === 401 || err.status === 403 ? 502 : 500).json({
      error: err.message || "Options analysis failed",
      requestId: err.requestId,
    });
  }
});

router.post("/execute", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { symbol, analysis } = req.body;
    const user = await getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const gateError = validateAnalysis(analysis);
    if (gateError) return res.json({ skipped: true, message: gateError, analysis });

    const account = await getAccount();
    const contract = analysis.optionsContract ||
      await chooseOptionContract(String(symbol).toUpperCase(), analysis.decision, Number(analysis.entryPrice));
    const qty = calculateQty(account, contract);
    const order = await placeOptionsOrder({
      symbol: contract.symbol,
      qty,
      side: "buy",
      positionIntent: "buy_to_open",
    });

    const [trade] = await db.insert(trades).values({
      userId: user.id,
      symbol: String(symbol).toUpperCase(),
      type: analysis.decision,
      entryPrice: String(analysis.entryPrice || 0),
      stopLoss: String(analysis.stopLoss || 0),
      takeProfit: String(analysis.takeProfit || 0),
      riskRewardRatio: String(analysis.riskRewardRatio || 0),
      recommendedLotSize: String(qty),
      riskPercent: String(MAX_RISK_PERCENT),
      accountBalanceAtSignal: String(account.equity),
      signalStatus: "active",
      aiReasoning: analysis.reasoning,
      aiConfidence: String(analysis.confidence),
      forecast: analysis.forecast,
      keyLevels: analysis.keyLevels,
      forecastData: {
        model: analysis.model,
        provider: analysis.provider,
        strategy: analysis.strategy,
        confluenceScore: analysis.confluenceScore,
        confluenceFactors: analysis.confluenceFactors,
        invalidationLevel: analysis.invalidationLevel,
        alpacaRequestId: order._requestId || null,
      },
      alpacaOrderId: order.id ? String(order.id) : null,
      optionSymbol: contract.symbol,
      optionType: contract.optionType,
      optionStrike: String(contract.strike),
      optionExpiration: contract.expiration ? new Date(contract.expiration) : null,
      optionPremium: contract.premium ? String(contract.premium) : null,
      confluenceScore: analysis.confluenceScore || 0,
      session: analysis.session,
    }).returning();

    await db.update(users).set({
      totalTrades: (user.totalTrades || 0) + 1,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    res.status(201).json({
      trade,
      order,
      analysis,
      optionSymbol: contract.symbol,
      quantity: qty,
      paper: true,
    });
  } catch (err) {
    req.log.error({ err }, "Options order execution failed");
    res.status(err.status === 403 || err.status === 422 ? 422 : 500).json({
      error: err.message || "Paper options order failed",
      requestId: err.requestId,
    });
  }
});

router.post("/:tradeId/close", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const tradeId = Number(req.params.tradeId);
    const outcome = String(req.body.outcome || "");
    const user = await getUser(userId);
    const [trade] = await db.select().from(trades).where(eq(trades.id, tradeId));
    if (!user || !trade || trade.userId !== user.id) return res.status(404).json({ error: "Trade not found" });
    if (!["tp_hit", "sl_hit", "expired"].includes(outcome)) return res.status(400).json({ error: "Invalid outcome" });
    const [updated] = await db.update(trades).set({
      signalStatus: outcome,
      closedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(trades.id, tradeId)).returning();
    res.json({ trade: updated, message: "Trade journal outcome recorded." });
  } catch (err) {
    req.log.error({ err }, "Trade outcome failed");
    res.status(500).json({ error: "Failed to record trade outcome" });
  }
});

router.get("/history", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const user = await getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(await db.select().from(trades).where(eq(trades.userId, user.id)).orderBy(desc(trades.createdAt)).limit(100));
  } catch (err) {
    req.log.error({ err }, "Trade history failed");
    res.status(500).json({ error: "Failed to get trade history" });
  }
});

router.get("/status", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const user = await getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const account = await getAccount();
    res.json({
      ...account,
      totalTrades: user.totalTrades || 0,
      tradingBalance: account.equity,
      autoTradeEnabled: Boolean(user.autoTradeEnabled),
      canTrade: account.status === "ACTIVE" && account.equity > 0,
      strategy: "Options Alpha / long premium",
      maxRiskPercent: MAX_RISK_PERCENT,
      confidenceGate: MIN_CONFIDENCE,
      confluenceGate: MIN_CONFLUENCE,
    });
  } catch (err) {
    req.log.error({ err }, "Trading status failed");
    res.status(502).json({ error: err.message || "Unable to read trading status" });
  }
});

router.get("/positions", requireAuth(), async (req, res) => {
  try {
    res.json(await getOpenPositions());
  } catch (err) {
    req.log.error({ err }, "Options positions failed");
    res.status(502).json({ error: err.message || "Unable to read options positions" });
  }
});

router.patch("/agent", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (typeof req.body.enabled !== "boolean") return res.status(400).json({ error: "enabled must be boolean" });
    const [updated] = await db.update(users)
      .set({ autoTradeEnabled: req.body.enabled, updatedAt: new Date() })
      .where(eq(users.clerkId, userId))
      .returning({ autoTradeEnabled: users.autoTradeEnabled });
    res.json(updated || { autoTradeEnabled: req.body.enabled });
  } catch (err) {
    req.log.error({ err }, "Agent toggle failed");
    res.status(500).json({ error: "Failed to update agent mode" });
  }
});

export default router;