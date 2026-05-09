import { Router } from "express";
import { requireUser, getAuth } from "../middlewares/authMiddleware.js";
import { eq, desc } from "drizzle-orm";
import { db, users, trades } from "../db/index.js";
import { analyzeMarket } from "../lib/cloudflare-ai.js";
import { getMarketDataWithIndicators, isTwelveDataEnabled } from "../lib/twelvedata.js";

const router = Router();

const TP_SIGNALS_BEFORE_SHARE = 3;
const MIN_BALANCE_USD = 10;

router.post("/analyze", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { symbol, accountBalance } = req.body;

    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found. Please sign in again." });

    if (Number(user.balance) < MIN_BALANCE_USD) {
      return res.status(402).json({
        error: "insufficient_balance",
        message: `A minimum GhostAgent balance of $${MIN_BALANCE_USD} is required to receive signals. Please deposit to your account.`,
      });
    }

    const shareRequired = user.tpSignalsSinceLastShare >= TP_SIGNALS_BEFORE_SHARE;
    if (shareRequired) {
      return res.status(402).json({
        error: "share_required",
        message: `You've had ${TP_SIGNALS_BEFORE_SHARE} signals reach Take Profit! Please send GhostAgent's 20% share before receiving more signals.`,
        tpSignals: user.tpSignalsSinceLastShare,
      });
    }

    const tradingBal = accountBalance
      ? parseFloat(accountBalance)
      : parseFloat(user.tradingBalance || 50);

    if (tradingBal < 10) {
      return res.status(400).json({ error: "Trading account balance must be at least $10 for proper risk management." });
    }

    let marketData;
    try {
      if (isTwelveDataEnabled()) {
        marketData = await getMarketDataWithIndicators(symbol);
      } else {
        return res.status(503).json({
          error: "Market data service is not configured. Please contact support.",
        });
      }
    } catch (e) {
      req.log.error({ err: e.message }, "Market data fetch failed");
      return res.status(503).json({
        error: "Unable to fetch live market data. Please try again in a moment.",
        detail: e.message,
      });
    }

    let analysis;
    try {
      analysis = await analyzeMarket({ symbol, marketData, accountBalance: tradingBal });
    } catch (e) {
      req.log.error({ err: e.message }, "AI analysis failed");
      return res.status(503).json({
        error: "AI analysis is unavailable right now. Please try again in a moment.",
        detail: e.message,
      });
    }

    if (accountBalance && parseFloat(accountBalance) !== parseFloat(user.tradingBalance || 0)) {
      await db.update(users).set({
        tradingBalance: String(tradingBal),
        updatedAt: new Date(),
      }).where(eq(users.clerkId, userId));
    }

    res.json({ analysis, marketData: {
      symbol: marketData.symbol,
      price: marketData.price,
      bid: marketData.bid,
      ask: marketData.ask,
      change: marketData.change,
      rsi: marketData.rsi,
      macd: { h1: marketData.macd?.h1 },
      bb: marketData.bb,
      atr: marketData.atr,
      stoch: marketData.stoch,
      ema: marketData.ema,
      candles: {
        h1: marketData.candles?.h1?.slice(-5),
        h4: marketData.candles?.h4?.slice(-3),
      },
      source: marketData.source,
    }});
  } catch (err) {
    req.log.error({ err }, "Signal analysis failed");
    res.status(500).json({ error: "Signal analysis failed: " + (err?.message || "unknown error") });
  }
});

router.post("/:signalId/outcome", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const signalId = parseInt(req.params.signalId);
    const { outcome } = req.body;

    if (!["tp_hit", "sl_hit", "expired"].includes(outcome)) {
      return res.status(400).json({ error: "outcome must be tp_hit, sl_hit, or expired" });
    }

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const [signal] = await db.select().from(trades).where(eq(trades.id, signalId));
    if (!signal || signal.userId !== user.id) return res.status(404).json({ error: "Signal not found" });
    if (signal.signalStatus !== "active") return res.status(400).json({ error: "Signal already has an outcome" });

    const [updated] = await db.update(trades).set({
      signalStatus: outcome,
      closedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(trades.id, signalId)).returning();

    let newTpCount = user.tpSignalsSinceLastShare || 0;
    if (outcome === "tp_hit") {
      newTpCount = newTpCount + 1;
      await db.update(users).set({
        tpSignalsSinceLastShare: newTpCount,
        totalTrades: user.totalTrades + 1,
        updatedAt: new Date(),
      }).where(eq(users.clerkId, userId));
    } else {
      await db.update(users).set({
        totalTrades: user.totalTrades + 1,
        updatedAt: new Date(),
      }).where(eq(users.clerkId, userId));
    }

    const shareRequired = newTpCount >= TP_SIGNALS_BEFORE_SHARE;

    res.json({
      signal: updated,
      shareRequired,
      tpCount: newTpCount,
      message: shareRequired
        ? `🎯 ${TP_SIGNALS_BEFORE_SHARE} signals hit TP! Please send GhostAgent's 20% share to continue.`
        : outcome === "tp_hit"
        ? "Take Profit hit! Well done."
        : "Signal outcome recorded.",
    });
  } catch (err) {
    req.log.error({ err }, "Signal outcome failed");
    res.status(500).json({ error: "Failed to update signal outcome" });
  }
});

router.post("/:signalId/journal", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const signalId = parseInt(req.params.signalId);
    const { note } = req.body;

    if (!note || typeof note !== "string") {
      return res.status(400).json({ error: "note is required" });
    }

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const [signal] = await db.select().from(trades).where(eq(trades.id, signalId));
    if (!signal || signal.userId !== user.id) return res.status(404).json({ error: "Signal not found" });

    const [updated] = await db.update(trades).set({
      journalNote: note.trim(),
      updatedAt: new Date(),
    }).where(eq(trades.id, signalId)).returning();

    res.json({ signal: updated });
  } catch (err) {
    req.log.error({ err }, "Journal update failed");
    res.status(500).json({ error: "Failed to update journal" });
  }
});

router.post("/save", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { symbol, analysis } = req.body;

    if (!symbol || !analysis) return res.status(400).json({ error: "symbol and analysis are required" });
    if (analysis.decision === "HOLD") return res.json({ saved: false, message: "HOLD signals are not saved." });

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    if (Number(user.balance) < MIN_BALANCE_USD) {
      return res.status(402).json({ error: `Minimum $${MIN_BALANCE_USD} GhostAgent balance required to save signals.` });
    }

    const shareRequired = user.tpSignalsSinceLastShare >= TP_SIGNALS_BEFORE_SHARE;
    if (shareRequired) {
      return res.status(402).json({
        error: "share_required",
        message: "Please send GhostAgent's 20% share before saving more signals.",
      });
    }

    const [signal] = await db.insert(trades).values({
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
      forecastData: {
        model: analysis.model,
        provider: analysis.provider,
        confluenceScore: analysis.confluenceScore,
        confluenceFactors: analysis.confluenceFactors,
        session: analysis.session,
        invalidationLevel: analysis.invalidationLevel,
      },
      confluenceScore: analysis.confluenceScore || 0,
      session: analysis.session,
    }).returning();

    res.status(201).json({ signal });
  } catch (err) {
    req.log.error({ err }, "Signal save failed");
    res.status(500).json({ error: err?.message || "Failed to save signal" });
  }
});

router.get("/history", requireUser(), async (req, res) => {
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
    req.log.error({ err }, "Signal history failed");
    res.status(500).json({ error: "Failed to get history" });
  }
});

router.get("/status", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const shareRequired = user.tpSignalsSinceLastShare >= TP_SIGNALS_BEFORE_SHARE;
    const tpUntilShare = shareRequired ? 0 : TP_SIGNALS_BEFORE_SHARE - (user.tpSignalsSinceLastShare || 0);
    const hasMinBalance = Number(user.balance) >= MIN_BALANCE_USD;

    res.json({
      balance: user.balance,
      currency: user.currency,
      tradingBalance: user.tradingBalance || 50,
      totalTrades: user.totalTrades,
      tpSignalsSinceLastShare: user.tpSignalsSinceLastShare || 0,
      tpUntilShare,
      shareRequired,
      hasMinBalance,
      canGetSignal: !shareRequired && hasMinBalance,
      ghostSharePercent: 20,
      userSharePercent: 80,
      hasMt5: !!user.mt5AccountId,
      mt5Login: user.mt5Login,
      mt5Server: user.mt5Server,
    });
  } catch (err) {
    req.log.error({ err }, "Signal status failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/set-balance", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { tradingBalance } = req.body;
    const bal = parseFloat(tradingBalance);
    if (!bal || bal < 10) return res.status(400).json({ error: "Trading balance must be at least $10" });

    await db.update(users).set({
      tradingBalance: String(bal),
      updatedAt: new Date(),
    }).where(eq(users.clerkId, userId));

    res.json({ success: true, tradingBalance: bal });
  } catch (err) {
    req.log.error({ err }, "Set balance failed");
    res.status(500).json({ error: "Failed to update balance" });
  }
});

export default router;
