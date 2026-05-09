import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { eq, desc } from "drizzle-orm";
import { db, users, trades } from "../db/index.js";
import { analyzeMarket } from "../lib/cloudflare-ai.js";
import { getMarketData, getAccountInfo, placeTrade, isMetaApiEnabled, getAccountStatus } from "../lib/metaapi.js";
import { getMarketDataWithIndicators, isTwelveDataEnabled } from "../lib/twelvedata.js";

const router = Router();

const USER_SHARE = 0.80;
const GHOST_SHARE = 0.20;
const TRADES_BEFORE_SHARE_REQUIRED = 3;
const MIN_BALANCE_USD = 10;

router.post("/analyze", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { symbol, accountBalance } = req.body;
    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (Number(user.balance) < MIN_BALANCE_USD) {
      return res.status(402).json({ error: `Insufficient GhostAgent balance. Please deposit at least $${MIN_BALANCE_USD} to start.` });
    }

    const shareRequired = user.tradesSinceLastShare >= TRADES_BEFORE_SHARE_REQUIRED && user.totalTrades > 0;
    if (shareRequired) {
      return res.status(402).json({
        error: "share_required",
        message: `You've had ${TRADES_BEFORE_SHARE_REQUIRED} successful trades. Please send GhostAgent's 20% share to continue.`,
        tradesCount: user.tradesSinceLastShare,
      });
    }

    const tradingBal = accountBalance
      ? parseFloat(accountBalance)
      : parseFloat(user.tradingBalance || 50);

    if (tradingBal < 10) {
      return res.status(400).json({ error: "Trading account balance must be at least $10 for risk management." });
    }

    let marketData = {};

    try {
      if (isTwelveDataEnabled()) {
        marketData = await getMarketDataWithIndicators(symbol);
      } else if (isMetaApiEnabled() && user.mt5AccountId && !user.mt5AccountId.startsWith("demo-")) {
        try {
          const status = await getAccountStatus(user.mt5AccountId);
          if (status.connectionStatus === "CONNECTED") {
            const mt5Data = await getMarketData(user.mt5AccountId, symbol);
            marketData = { symbol, price: mt5Data.currentPrice, bid: mt5Data.bid, ask: mt5Data.ask };
          }
        } catch (_) {}
      }
    } catch (e) {
      req.log.warn({ err: e.message }, "Market data fetch failed, using defaults");
    }

    if (!marketData.price) {
      const base = symbol.includes("JPY") ? 149.5 : symbol.includes("XAU") ? 2350 : symbol.includes("GBP") ? 1.275 : 1.085;
      marketData = { symbol, price: base, bid: base - 0.00015, ask: base + 0.00015 };
    }

    const analysis = await analyzeMarket({ symbol, marketData, accountBalance: tradingBal });
    res.json({ analysis, marketData });
  } catch (err) {
    req.log.error({ err }, "Trade analysis failed");
    res.status(500).json({ error: "Analysis failed: " + (err?.message || "unknown error") });
  }
});

router.post("/execute", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { symbol, analysis } = req.body;

    if (!symbol || !analysis) return res.status(400).json({ error: "symbol and analysis are required" });

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    if (Number(user.balance) < MIN_BALANCE_USD) {
      return res.status(402).json({ error: `Insufficient GhostAgent balance. Please deposit at least $${MIN_BALANCE_USD}.` });
    }

    if (!user.mt5AccountId) {
      return res.status(400).json({ error: "No MT5 account connected. Connect your MT5 account first." });
    }

    const shareRequired = user.tradesSinceLastShare >= TRADES_BEFORE_SHARE_REQUIRED && user.totalTrades > 0;
    if (shareRequired) {
      return res.status(402).json({
        error: "share_required",
        message: `You've had ${TRADES_BEFORE_SHARE_REQUIRED} successful trades. Please send GhostAgent's 20% share to continue trading.`,
        tradesCount: user.tradesSinceLastShare,
      });
    }

    if (analysis.decision === "HOLD") {
      return res.json({ skipped: true, message: "GhostAgent decided to HOLD — market conditions are not optimal. No trade placed.", analysis });
    }

    if (analysis.confidence < 72) {
      return res.json({ skipped: true, message: `Signal confidence (${analysis.confidence}%) below threshold. GhostAgent only executes at 72%+ confidence. No trade placed.`, analysis });
    }

    let mt5Result = null;
    let mt5TicketId = null;

    if (isMetaApiEnabled() && !user.mt5AccountId.startsWith("demo-")) {
      try {
        const status = await getAccountStatus(user.mt5AccountId);
        if (status.connectionStatus === "CONNECTED") {
          mt5Result = await placeTrade(user.mt5AccountId, {
            symbol,
            type: analysis.decision,
            volume: analysis.recommendedLotSize || 0.01,
            stopLoss: analysis.stopLoss,
            takeProfit: analysis.takeProfit,
          });
          mt5TicketId = mt5Result?.orderId || mt5Result?.positionId || null;
        } else {
          return res.status(503).json({ error: "MT5 account is not connected. Please check your account status." });
        }
      } catch (e) {
        req.log.error({ err: e.message }, "MT5 trade execution failed");
        return res.status(500).json({ error: "MT5 trade failed: " + e.message });
      }
    } else if (user.mt5AccountId.startsWith("demo-")) {
      mt5TicketId = `demo-${Date.now()}`;
    }

    const [trade] = await db.insert(trades).values({
      userId: user.id,
      symbol,
      type: analysis.decision,
      entryPrice: String(analysis.entryPrice || 0),
      stopLoss: String(analysis.stopLoss || 0),
      takeProfit: String(analysis.takeProfit || 0),
      stopLossPips: String(analysis.stopLossPips || 0),
      takeProfitPips: String(analysis.takeProfitPips || 0),
      riskRewardRatio: String(analysis.riskRewardRatio || "N/A"),
      recommendedLotSize: String(analysis.recommendedLotSize || 0.01),
      riskPercent: String(analysis.riskPercent || 1),
      accountBalanceAtSignal: String(analysis.accountBalance || user.tradingBalance || 50),
      signalStatus: "active",
      aiReasoning: analysis.reasoning,
      aiConfidence: String(analysis.confidence),
      forecast: analysis.forecast,
      keyLevels: analysis.keyLevels,
      forecastData: { model: analysis.model, provider: analysis.provider, confluenceScore: analysis.confluenceScore, mt5Ticket: mt5TicketId },
      mt5TicketId: mt5TicketId ? String(mt5TicketId) : null,
      confluenceScore: analysis.confluenceScore || 0,
      session: analysis.session,
    }).returning();

    await db.update(users).set({
      totalTrades: user.totalTrades + 1,
      tradesSinceLastShare: user.tradesSinceLastShare + 1,
      updatedAt: new Date(),
    }).where(eq(users.clerkId, userId));

    res.status(201).json({ trade, mt5Result, analysis, mt5TicketId });
  } catch (err) {
    req.log.error({ err }, "Trade execution failed");
    res.status(500).json({ error: err?.message || "Trade execution failed" });
  }
});

router.post("/:tradeId/close", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const tradeId = parseInt(req.params.tradeId);
    const { outcome } = req.body;

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    const [trade] = await db.select().from(trades).where(eq(trades.id, tradeId));

    if (!trade || trade.userId !== user.id) return res.status(404).json({ error: "Trade not found" });
    if (trade.signalStatus !== "active") return res.status(400).json({ error: "Trade already closed" });

    const validOutcomes = ["tp_hit", "sl_hit", "expired"];
    if (!validOutcomes.includes(outcome)) return res.status(400).json({ error: "Invalid outcome" });

    const [updated] = await db.update(trades).set({
      signalStatus: outcome,
      closedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(trades.id, tradeId)).returning();

    if (outcome === "tp_hit") {
      await db.update(users).set({
        tpSignalsSinceLastShare: (user.tpSignalsSinceLastShare || 0) + 1,
        updatedAt: new Date(),
      }).where(eq(users.clerkId, userId));
    }

    res.json({ trade: updated, message: outcome === "tp_hit" ? "Trade closed with profit!" : "Trade closed." });
  } catch (err) {
    req.log.error({ err }, "Trade close failed");
    res.status(500).json({ error: "Failed to close trade" });
  }
});

router.get("/history", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const history = await db.select().from(trades)
      .where(eq(trades.userId, user.id))
      .orderBy(desc(trades.createdAt))
      .limit(50);

    res.json(history);
  } catch (err) {
    req.log.error({ err }, "Trade history failed");
    res.status(500).json({ error: "Failed to get trade history" });
  }
});

router.get("/status", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const shareRequired = user.tradesSinceLastShare >= TRADES_BEFORE_SHARE_REQUIRED && user.totalTrades > 0;
    const tradesUntilShare = shareRequired ? 0 : TRADES_BEFORE_SHARE_REQUIRED - (user.tradesSinceLastShare || 0);

    res.json({
      balance: user.balance,
      currency: user.currency,
      tradingBalance: user.tradingBalance || 50,
      totalTrades: user.totalTrades,
      tradesSinceLastShare: user.tradesSinceLastShare || 0,
      tpSignalsSinceLastShare: user.tpSignalsSinceLastShare || 0,
      shareRequired,
      tradesUntilShare,
      totalProfit: user.totalProfit,
      hasMt5: !!user.mt5AccountId,
      mt5Login: user.mt5Login,
      mt5Server: user.mt5Server,
      canTrade: Number(user.balance) >= MIN_BALANCE_USD && !!user.mt5AccountId && !shareRequired,
      ghostSharePercent: GHOST_SHARE * 100,
      userSharePercent: USER_SHARE * 100,
    });
  } catch (err) {
    req.log.error({ err }, "Trading status failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
