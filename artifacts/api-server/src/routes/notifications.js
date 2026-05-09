import { Router } from "express";
import { requireUser, getAuth } from "../middlewares/authMiddleware.js";
import { notificationBus } from "../lib/notifications.js";
import crypto from "crypto";

const router = Router();

// In-memory nonce store: nonce -> { userId, expiresAt }
const nonceStore = new Map();
const NONCE_TTL_MS = 30_000;

// Clean up expired nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of nonceStore) {
    if (v.expiresAt < now) nonceStore.delete(k);
  }
}, 60_000);

// Step 1: Exchange Clerk JWT for a short-lived SSE nonce
router.post("/token", requireUser(), (req, res) => {
  const { userId } = getAuth(req);
  const nonce = crypto.randomBytes(24).toString("hex");
  nonceStore.set(nonce, { userId, expiresAt: Date.now() + NONCE_TTL_MS });
  res.json({ token: nonce });
});

// Step 2: Open SSE stream using the nonce
router.get("/stream", (req, res) => {
  const { token } = req.query;
  const entry = token ? nonceStore.get(token) : null;

  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(401).json({ error: "Invalid or expired stream token" });
  }

  const { userId } = entry;
  nonceStore.delete(token); // one-time use

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);

  res.write(`data: ${JSON.stringify({ type: "connected", message: "GhostAgent live feed active" })}\n\n`);

  const onSignal = (payload) => {
    res.write(`data: ${JSON.stringify({ type: "signal", ...payload })}\n\n`);
  };

  notificationBus.on(`signal:${userId}`, onSignal);

  req.on("close", () => {
    clearInterval(heartbeat);
    notificationBus.off(`signal:${userId}`, onSignal);
  });
});

export default router;
