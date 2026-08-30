import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import signalsRouter from "./signals.js";
import paymentsRouter from "./payments.js";
import alpacaRouter from "./alpaca.js";
import tradingRouter from "./trading.js";
import notificationsRouter from "./notifications.js";
import watchlistRouter from "./watchlist.js";

const router = Router();
router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/signals", signalsRouter);
router.use("/payments", paymentsRouter);
router.use("/alpaca", alpacaRouter);
router.use("/trading", tradingRouter);
router.use("/notifications", notificationsRouter);
router.use("/watchlist", watchlistRouter);

export default router;
