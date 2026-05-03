import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { eq, desc } from "drizzle-orm";
import { db, users, trades } from "../db/index.js";
import { analyzeMarket } from "../lib/cloudflare-ai.js";
import { getMarketDataWithIndicators, isAlphaVantageEnabled } from "../lib/alphavantage.js";

const router = Router();

const TP_SIGNALS_BEFORE_SHARE = 3;

function buildFallbackMarketData(symbol) {
  const s = symbol.toUpperCase();
  const isJPY = s.includes("JPY");
  const isXAU = s.includes("XAU");
  const isXAG = s.includes("XAG");
  const isBTC = s.includes("BTC");
  const isETH = s.includes("ETH");
  const isOIL = s === "USOIL" || s === "WTI";

  let base = isJPY ? 149.5 : isXAU ? 2350 : isXAG ? 27.5 : isBTC ? 67000 : isETH ? 3200 : isOIL ? 82 : 1.085;
  const spread = isXAU ? 0.5 : isJPY ? 0.015 : isBTC ? 50 : isETH ? 5 : 0.00015;

  return {
    symbol,
    price: base,
    bid: base - spread,
    ask: base + spread,
    change: "0",
    candles: [],
    rsi: null,
    macd: null,
    source: "fallback",
  };
}

router.post("/analyze", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { symbol, accountBalance } = req.body;

    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const shareRequired = user.tpSignalsSinceLastShare >= TP_SIGNALS_BEFORE_SHARE;
    if (shareRequired) {
      return res.status(402).json({
        error: "share_required",
        message: `You've had ${TP_SIGNALS_BEFORE_SHARE} signals reach Take Profit! Please send GhostAgent's share before receiving more signals.`,
        tpSignals: user.tpSignalsSinceLastShare,
      });
    }

    const tradingBal = accountBalance
      ? parseFloat(accountBalance)
      : parseFloat(user.tradingBalance || 1000);

    if (tradingBal < 10) {
      return res.status(400).json({ error: "Account balance must be at least $10 for risk management calculation." });
    }

    let marketData;
    try {
      if (isAlphaVantageEnabled()) {
        marketData = await getMarketDataWithIndicators(symbol);
      } else {
        marketData = buildFallbackMarketData(symbol);
      }
    } catch (e) {
      req.log.warn({ err: e.message }, "Market data fetch failed, using fallback");
      marketData = buildFallbackMarketData(symbol);
    }

    const analysis = await analyzeMarket({ symbol, marketData, accountBalance: tradingBal });

    if (accountBalance && parseFloat(accountBalance) !== parseFloat(user.tradingBalance || 0)) {
      await db.update(users).set({
        tradingBalance: String(tradingBal),
        updatedAt: new Date(),
      }).where(eq(users.clerkId, userId));
    }

    res.json({ analysis, marketData });
  } catch (err) {
    req.log.error({ err }, "Signal analysis failed");
    res.status(500).json({ error: "Analysis failed: " + (err?.message || "unknown error") });
  }
});

router.post("/:signalId/outcome", requireAuth(), async (req, res) => {
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

    if (outcome === "tp_hit") {
      const newTpCount = (user.tpSignalsSinceLastShare || 0) + 1;
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

    const shareRequired = outcome === "tp_hit" && (user.tpSignalsSinceLastShare + 1) >= TP_SIGNALS_BEFORE_SHARE;

    res.json({
      signal: updated,
      shareRequired,
      message: shareRequired
        ? "Congratulations! 3 signals hit TP. Please send GhostAgent's share to continue."
        : outcome === "tp_hit"
        ? "Great job! TP hit recorded."
        : "Signal outcome recorded.",
    });
  } catch (err) {
    req.log.error({ err }, "Signal outcome failed");
    res.status(500).json({ error: "Failed to update signal outcome" });
  }
});

router.post("/:signalId/journal", requireAuth(), async (req, res) => {
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

router.post("/save", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { symbol, analysis } = req.body;

    if (!symbol || !analysis) return res.status(400).json({ error: "symbol and analysis are required" });
    if (analysis.decision === "HOLD") return res.json({ saved: false, message: "HOLD signals are not saved." });

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const shareRequired = user.tpSignalsSinceLastShare >= TP_SIGNALS_BEFORE_SHARE;
    if (shareRequired) {
      return res.status(402).json({
        error: "share_required",
        message: "Please send GhostAgent's share before saving more signals.",
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
      accountBalanceAtSignal: String(analysis.accountBalance || user.tradingBalance || 1000),
      signalStatus: "active",
      aiReasoning: analysis.reasoning,
      aiConfidence: String(analysis.confidence),
      forecast: analysis.forecast,
      keyLevels: analysis.keyLevels,
      forecastData: { model: analysis.model, provider: analysis.provider },
    }).returning();

    res.status(201).json({ signal });
  } catch (err) {
    req.log.error({ err }, "Signal save failed");
    res.status(500).json({ error: err?.message || "Failed to save signal" });
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
    req.log.error({ err }, "Signal history failed");
    res.status(500).json({ error: "Failed to get history" });
  }
});

router.get("/status", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const shareRequired = user.tpSignalsSinceLastShare >= TP_SIGNALS_BEFORE_SHARE;
    const tpUntilShare = shareRequired ? 0 : TP_SIGNALS_BEFORE_SHARE - (user.tpSignalsSinceLastShare || 0);

    res.json({
      balance: user.balance,
      currency: user.currency,
      tradingBalance: user.tradingBalance || 1000,
      totalTrades: user.totalTrades,
      tpSignalsSinceLastShare: user.tpSignalsSinceLastShare || 0,
      tpUntilShare,
      shareRequired,
      canGetSignal: !shareRequired,
    });
  } catch (err) {
    req.log.error({ err }, "Signal status failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/market/:symbol", requireAuth(), async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!isAlphaVantageEnabled()) {
      return res.json({ symbol, price: 0, bid: 0, ask: 0, change: "0", source: "unavailable", note: "Alpha Vantage API key not configured" });
    }
    const data = await getMarketDataWithIndicators(symbol);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Market data failed");
    res.status(500).json({ error: err?.message || "Failed to get market data" });
  }
});

router.post("/set-balance", requireAuth(), async (req, res) => {
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
