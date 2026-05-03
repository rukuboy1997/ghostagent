import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, users, deposits } from "../db/index.js";

const router = Router();

router.post("/verify-deposit", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { txRef, txId, amount, currency, flutterwaveStatus } = req.body;

    if (!txRef || !txId) return res.status(400).json({ error: "txRef and txId are required" });
    if (flutterwaveStatus !== "successful") return res.status(400).json({ error: "Payment was not successful" });

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const [existing] = await db.select().from(deposits).where(eq(deposits.flutterwaveTxId, String(txId)));
    if (existing) return res.status(409).json({ error: "Transaction already processed" });

    const amountUsd = currency === "USD" ? amount : currency === "NGN" ? amount / 1600 : amount;

    const [deposit] = await db.insert(deposits).values({
      userId: user.id,
      amount: String(amount),
      currency,
      amountUsd: String(amountUsd),
      type: "deposit",
      status: "completed",
      flutterwaveTxRef: txRef,
      flutterwaveTxId: String(txId),
      note: "Account top-up",
    }).returning();

    const newBalance = Number(user.balance) + amountUsd;
    await db.update(users).set({
      balance: String(newBalance),
      updatedAt: new Date(),
    }).where(eq(users.clerkId, userId));

    res.json({ success: true, deposit, newBalance, amountUsd });
  } catch (err) {
    req.log.error({ err }, "Deposit verification failed");
    res.status(500).json({ error: "Failed to verify deposit" });
  }
});

router.post("/verify-share", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { txRef, txId, amount, currency, flutterwaveStatus } = req.body;

    if (!txRef || !txId) return res.status(400).json({ error: "txRef and txId are required" });
    if (flutterwaveStatus !== "successful") return res.status(400).json({ error: "Payment was not successful" });

    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const [existing] = await db.select().from(deposits).where(eq(deposits.flutterwaveTxId, String(txId)));
    if (existing) return res.status(409).json({ error: "Transaction already processed" });

    const amountUsd = currency === "USD" ? amount : currency === "NGN" ? amount / 1600 : amount;

    await db.insert(deposits).values({
      userId: user.id,
      amount: String(amount),
      currency,
      amountUsd: String(amountUsd),
      type: "ghost_share",
      status: "completed",
      flutterwaveTxRef: txRef,
      flutterwaveTxId: String(txId),
      note: "GhostAgent share payment",
    });

    await db.update(users).set({
      tpSignalsSinceLastShare: 0,
      tradesSinceLastShare: 0,
      updatedAt: new Date(),
    }).where(eq(users.clerkId, userId));

    res.json({ success: true, message: "Ghost share paid. You can now receive more signals." });
  } catch (err) {
    req.log.error({ err }, "Share verification failed");
    res.status(500).json({ error: "Failed to verify share payment" });
  }
});

router.get("/history", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const history = await db.select().from(deposits)
      .where(eq(deposits.userId, user.id))
      .orderBy(deposits.createdAt);

    res.json(history);
  } catch (err) {
    req.log.error({ err }, "Payment history failed");
    res.status(500).json({ error: "Failed to get payment history" });
  }
});

export default router;
