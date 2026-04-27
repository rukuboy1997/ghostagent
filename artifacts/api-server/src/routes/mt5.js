import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, users } from "../db/index.js";
import { connectAccount, getAccountInfo, getMarketData, getOpenTrades, isMetaApiEnabled } from "../lib/metaapi.js";

const router = Router();

router.post("/connect", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { mt5Login, mt5Password, mt5Server } = req.body;

    if (!mt5Login || !mt5Password || !mt5Server) {
      return res.status(400).json({ error: "mt5Login, mt5Password, and mt5Server are required" });
    }

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!isMetaApiEnabled()) {
      await db.update(users).set({
        mt5Login: String(mt5Login),
        mt5Server,
        mt5AccountId: `demo-${mt5Login}`,
        updatedAt: new Date()
      }).where(eq(users.clerkId, userId));
      return res.json({ success: true, accountId: `demo-${mt5Login}`, demo: true, message: "Demo mode: MetaAPI not configured." });
    }

    const { accountId } = await connectAccount(mt5Login, mt5Password, mt5Server);

    await db.update(users).set({
      mt5Login: String(mt5Login),
      mt5Password,
      mt5Server,
      mt5AccountId: accountId,
      updatedAt: new Date()
    }).where(eq(users.clerkId, userId));

    res.json({ success: true, accountId });
  } catch (err) {
    req.log.error({ err }, "MT5 connect failed");
    res.status(500).json({ error: err?.message || "Failed to connect MT5 account" });
  }
});

router.get("/account", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user?.mt5AccountId) return res.status(404).json({ error: "No MT5 account connected" });

    if (!isMetaApiEnabled() || user.mt5AccountId?.startsWith("demo-")) {
      return res.json({
        balance: 10000,
        equity: 10250,
        freeMargin: 9800,
        currency: "USD",
        leverage: 100,
        demo: true
      });
    }

    const info = await getAccountInfo(user.mt5AccountId);
    res.json(info);
  } catch (err) {
    req.log.error({ err }, "MT5 account info failed");
    res.status(500).json({ error: err?.message || "Failed to get account info" });
  }
});

router.get("/market/:symbol", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { symbol } = req.params;
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user?.mt5AccountId) return res.status(404).json({ error: "No MT5 account connected" });

    if (!isMetaApiEnabled() || user.mt5AccountId?.startsWith("demo-")) {
      const base = symbol.includes("USD") ? 1.0850 : symbol.includes("GBP") ? 1.2750 : symbol.includes("JPY") ? 149.50 : 1.0;
      const spread = 0.00015;
      return res.json({
        symbol,
        bid: (base - spread).toFixed(5),
        ask: (base + spread).toFixed(5),
        currentPrice: base.toFixed(5),
        change: (Math.random() * 0.4 - 0.2).toFixed(3),
        demo: true
      });
    }

    const data = await getMarketData(user.mt5AccountId, symbol);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "MT5 market data failed");
    res.status(500).json({ error: err?.message || "Failed to get market data" });
  }
});

router.get("/positions", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user?.mt5AccountId) return res.json([]);

    if (!isMetaApiEnabled() || user.mt5AccountId?.startsWith("demo-")) {
      return res.json([]);
    }

    const positions = await getOpenTrades(user.mt5AccountId);
    res.json(positions);
  } catch (err) {
    req.log.error({ err }, "MT5 positions failed");
    res.status(500).json({ error: err?.message || "Failed to get positions" });
  }
});

export default router;
