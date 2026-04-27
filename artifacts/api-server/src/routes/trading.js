import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { eq, desc } from "drizzle-orm";
import { db, users, trades } from "../db/index.js";
import { analyzeMarket } from "../lib/cloudflare-ai.js";
import { getMarketData, getAccountInfo, placeTrade, isMetaApiEnabled } from "../lib/metaapi.js";

const router = Router();

const USER_SHARE = 0.70;
const GHOST_SHARE = 0.30;
const TRADES_BEFORE_SHARE_REQUIRED = 3;
const MIN_BALANCE_USD = 5;

router.post("/analyze", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (Number(user.balance) < MIN_BALANCE_USD) {
      return res.status(402).json({ error: "Insufficient balance. Please deposit at least $5 to start trading." });
    }
    if (!user.mt5AccountId) {
      return res.status(400).json({ error: "No MT5 account connected. Connect your MT5 account first." });
    }

    let marketData = {};
    let accountInfo = {};

    try {
      if (isMetaApiEnabled() && !user.mt5AccountId?.startsWith("demo-")) {
        [marketData, accountInfo] = await Promise.all([
          getMarketData(user.mt5AccountId, symbol),
          getAccountInfo(user.mt5AccountId),
        ]);
      } else {
        const base = symbol.includes("JPY") ? 149.5 : 1.085;
        marketData = { symbol, currentPrice: base, bid: base - 0.00015, ask: base + 0.00015 };
        accountInfo = { balance: 10000, equity: 10250, freeMargin: 9800 };
      }
    } catch (e) {
      console.warn("MetaAPI data fetch failed, using defaults:", e.message);
    }

    const analysis = await analyzeMarket({ symbol, marketData, userContext: accountInfo });
    res.json({ analysis, marketData });
  } catch (err) {
    req.log.error({ err }, "Trade analysis failed");
    res.status(500).json({ error: "Analysis failed" });
  }
});

router.post("/execute", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { symbol, analysis } = req.body;

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (Number(user.balance) < MIN_BALANCE_USD) {
      return res.status(402).json({ error: "Insufficient balance." });
    }
    if (!user.mt5AccountId) {
      return res.status(400).json({ error: "No MT5 account connected." });
    }

    if (user.tradesSinceLastShare >= TRADES_BEFORE_SHARE_REQUIRED && user.totalTrades > 0) {
      return res.status(402).json({
        error: "share_required",
        message: `You've completed ${TRADES_BEFORE_SHARE_REQUIRED} trades. Please pay GhostAgent's 30% share to continue trading.`,
        tradesCount: user.tradesSinceLastShare,
      });
    }

    if (analysis.decision === "HOLD") {
      return res.json({ skipped: true, message: "GhostAgent decided to HOLD — no trade placed.", analysis });
    }

    let mt5Result = null;
    let mt5TicketId = null;

    if (isMetaApiEnabled() && !user.mt5AccountId?.startsWith("demo-")) {
      mt5Result = await placeTrade(user.mt5AccountId, {
        symbol,
        type: analysis.decision,
        volume: analysis.volume,
        stopLoss: analysis.stopLoss,
        takeProfit: analysis.takeProfit,
      });
      mt5TicketId = mt5Result?.orderId || mt5Result?.positionId || null;
    }

    const [trade] = await db.insert(trades).values({
      userId: user.id,
      symbol,
      type: analysis.decision,
      volume: String(analysis.volume),
      openPrice: String(analysis.entryPrice || 0),
      status: "open",
      mt5TicketId: String(mt5TicketId || `demo-${Date.now()}`),
      aiReasoning: analysis.reasoning,
      aiConfidence: String(analysis.confidence),
      forecastData: { forecast: analysis.forecast, model: analysis.model },
    }).returning();

    await db.update(users).set({
      totalTrades: user.totalTrades + 1,
      tradesSinceLastShare: user.tradesSinceLastShare + 1,
      updatedAt: new Date(),
    }).where(eq(users.clerkId, userId));

    res.status(201).json({ trade, mt5Result, analysis });
  } catch (err) {
    req.log.error({ err }, "Trade execution failed");
    res.status(500).json({ error: err?.message || "Trade execution failed" });
  }
});

router.post("/:tradeId/close", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const tradeId = parseInt(req.params.tradeId);
    const { closePrice } = req.body;

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    const [trade] = await db.select().from(trades).where(eq(trades.id, tradeId));

    if (!trade || trade.userId !== user.id) return res.status(404).json({ error: "Trade not found" });
    if (trade.status !== "open") return res.status(400).json({ error: "Trade already closed" });

    const openP = Number(trade.openPrice);
    const closeP = closePrice || openP * (1 + (Math.random() * 0.02 - 0.01));
    const priceDiff = trade.type === "BUY" ? closeP - openP : openP - closeP;
    const profit = priceDiff * Number(trade.volume) * 100000;
    const userProfit = profit * USER_SHARE;
    const ghostShareAmount = profit * GHOST_SHARE;

    const [updated] = await db.update(trades).set({
      status: profit > 0 ? "profit" : "loss",
      closePrice: String(closeP),
      profit: String(profit),
      userProfit: String(userProfit),
      ghostShare: String(ghostShareAmount),
      closedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(trades.id, tradeId)).returning();

    await db.update(users).set({
      totalProfit: String(Number(user.totalProfit) + userProfit),
      updatedAt: new Date(),
    }).where(eq(users.clerkId, userId));

    res.json({ trade: updated, userProfit, ghostShare: ghostShareAmount });
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
    const tradesUntilShare = shareRequired ? 0 : TRADES_BEFORE_SHARE_REQUIRED - user.tradesSinceLastShare;

    res.json({
      balance: user.balance,
      currency: user.currency,
      totalTrades: user.totalTrades,
      tradesSinceLastShare: user.tradesSinceLastShare,
      shareRequired,
      tradesUntilShare,
      totalProfit: user.totalProfit,
      hasMt5: !!user.mt5AccountId,
      canTrade: Number(user.balance) >= MIN_BALANCE_USD && !!user.mt5AccountId && !shareRequired,
    });
  } catch (err) {
    req.log.error({ err }, "Trading status failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
