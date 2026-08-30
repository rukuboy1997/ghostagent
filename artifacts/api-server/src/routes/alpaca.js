import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, users } from "../db/index.js";
import {
  alpacaConfigSummary,
  getAccount,
  getClock,
  getOpenPositions,
  getOrders,
  getMarketDataWithIndicators,
} from "../lib/alpaca.js";

const router = Router();

router.get("/status", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    const account = await getAccount();
    res.json({
      ...alpacaConfigSummary(),
      connected: true,
      paper: true,
      account,
      agentEnabled: Boolean(user?.autoTradeEnabled),
    });
  } catch (err) {
    req.log.error({ err }, "Alpaca status failed");
    res.status(err.status === 401 || err.status === 403 ? 502 : 500).json({
      error: err.message || "Unable to reach Alpaca paper account",
      configured: alpacaConfigSummary().configured,
      connected: false,
    });
  }
});

router.get("/account", requireAuth(), async (req, res) => {
  try {
    res.json(await getAccount());
  } catch (err) {
    req.log.error({ err }, "Alpaca account failed");
    res.status(502).json({ error: err.message || "Unable to read Alpaca account" });
  }
});

router.get("/clock", requireAuth(), async (req, res) => {
  try {
    res.json(await getClock());
  } catch (err) {
    req.log.error({ err }, "Alpaca clock failed");
    res.status(502).json({ error: err.message || "Unable to read Alpaca market clock" });
  }
});

router.get("/positions", requireAuth(), async (req, res) => {
  try {
    res.json(await getOpenPositions());
  } catch (err) {
    req.log.error({ err }, "Alpaca positions failed");
    res.status(502).json({ error: err.message || "Unable to read Alpaca positions" });
  }
});

router.get("/orders", requireAuth(), async (req, res) => {
  try {
    res.json(await getOrders(req.query.status || "open"));
  } catch (err) {
    req.log.error({ err }, "Alpaca orders failed");
    res.status(502).json({ error: err.message || "Unable to read Alpaca orders" });
  }
});

router.get("/market/:symbol", requireAuth(), async (req, res) => {
  try {
    res.json(await getMarketDataWithIndicators(req.params.symbol.toUpperCase()));
  } catch (err) {
    req.log.error({ err, symbol: req.params.symbol }, "Alpaca market data failed");
    res.status(502).json({ error: err.message || "Unable to read Alpaca market data" });
  }
});

export default router;