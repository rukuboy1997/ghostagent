import { Router } from "express";
import { requireUser, getAuth } from "../middlewares/authMiddleware.js";
import { eq } from "drizzle-orm";
import { db, users } from "../db/index.js";

const router = Router();

router.post("/sync", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { email, name } = req.body;

    const [existing] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (existing) {
      return res.json({ user: existing, created: false });
    }

    const [user] = await db.insert(users).values({
      clerkId: userId,
      email: email || "",
      name: name || "",
      balance: "0",
      tradingBalance: "50",
    }).returning();

    res.status(201).json({ user, created: true });
  } catch (err) {
    req.log.error({ err }, "Auth sync failed");
    res.status(500).json({ error: "Failed to sync user" });
  }
});

router.get("/me", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Get me failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/me", requireUser(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { name, currency } = req.body;
    const [user] = await db.update(users)
      .set({ name, currency, updatedAt: new Date() })
      .where(eq(users.clerkId, userId))
      .returning();
    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Update me failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
