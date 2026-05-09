import { Router } from "express";
import { requireUser, getAuth } from "../middlewares/authMiddleware.js";
import { eq, and } from "drizzle-orm";
import { db, users, watchlist } from "../db/index.js";

const router = Router();

const MAX_PAIRS = 12;

const VALID_INTERVALS = [5, 10, 15, 30];
const VALID_SESSION_FILTERS = ["major", "all", "london_only"];

// GET /api/watchlist — fetch user's watchlist + scan settings
router.get("/", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const pairs = await db
      .select()
      .from(watchlist)
      .where(and(eq(watchlist.userId, user.id), eq(watchlist.isActive, true)));

    res.json({
      pairs: pairs.map(p => p.symbol),
      scanEnabled: user.scanEnabled,
      scanIntervalMinutes: user.scanIntervalMinutes,
      scanSessionFilter: user.scanSessionFilter,
      lastScannedAt: user.lastScannedAt,
    });
  } catch (err) {
    req.log.error({ err }, "Watchlist GET failed");
    res.status(500).json({ error: "Failed to fetch watchlist" });
  }
});

// PUT /api/watchlist/pairs — replace full pairs list
router.put("/pairs", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { pairs } = req.body;
    if (!Array.isArray(pairs)) return res.status(400).json({ error: "pairs must be an array" });
    if (pairs.length > MAX_PAIRS) return res.status(400).json({ error: `Maximum ${MAX_PAIRS} pairs allowed` });

    const symbols = [...new Set(pairs.map(p => String(p).toUpperCase().trim()))].filter(Boolean);

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    // Deactivate all existing pairs
    await db.update(watchlist).set({ isActive: false }).where(eq(watchlist.userId, user.id));

    // Upsert each symbol
    for (const symbol of symbols) {
      const [existing] = await db.select().from(watchlist)
        .where(and(eq(watchlist.userId, user.id), eq(watchlist.symbol, symbol)));
      if (existing) {
        await db.update(watchlist).set({ isActive: true }).where(eq(watchlist.id, existing.id));
      } else {
        await db.insert(watchlist).values({ userId: user.id, symbol, isActive: true });
      }
    }

    res.json({ pairs: symbols, message: `Watchlist updated with ${symbols.length} pairs` });
  } catch (err) {
    req.log.error({ err }, "Watchlist PUT pairs failed");
    res.status(500).json({ error: "Failed to update pairs" });
  }
});

// PATCH /api/watchlist/settings — update scan settings only
router.patch("/settings", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { scanEnabled, scanIntervalMinutes, scanSessionFilter } = req.body;

    const updates = { updatedAt: new Date() };
    if (typeof scanEnabled === "boolean") updates.scanEnabled = scanEnabled;
    if (scanIntervalMinutes !== undefined) {
      const mins = Number(scanIntervalMinutes);
      if (!VALID_INTERVALS.includes(mins)) {
        return res.status(400).json({ error: `scanIntervalMinutes must be one of: ${VALID_INTERVALS.join(", ")}` });
      }
      updates.scanIntervalMinutes = mins;
    }
    if (scanSessionFilter !== undefined) {
      if (!VALID_SESSION_FILTERS.includes(scanSessionFilter)) {
        return res.status(400).json({ error: `scanSessionFilter must be one of: ${VALID_SESSION_FILTERS.join(", ")}` });
      }
      updates.scanSessionFilter = scanSessionFilter;
    }

    await db.update(users).set(updates).where(eq(users.clerkId, userId));

    const [updated] = await db.select().from(users).where(eq(users.clerkId, userId));
    res.json({
      scanEnabled: updated.scanEnabled,
      scanIntervalMinutes: updated.scanIntervalMinutes,
      scanSessionFilter: updated.scanSessionFilter,
      lastScannedAt: updated.lastScannedAt,
    });
  } catch (err) {
    req.log.error({ err }, "Watchlist PATCH settings failed");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// DELETE /api/watchlist/pairs/:symbol
router.delete("/pairs/:symbol", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const symbol = req.params.symbol.toUpperCase();

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    await db.update(watchlist)
      .set({ isActive: false })
      .where(and(eq(watchlist.userId, user.id), eq(watchlist.symbol, symbol)));

    res.json({ removed: symbol });
  } catch (err) {
    req.log.error({ err }, "Watchlist DELETE pair failed");
    res.status(500).json({ error: "Failed to remove pair" });
  }
});

export default router;
