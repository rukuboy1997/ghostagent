import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import signalsRouter from "./signals.js";
import paymentsRouter from "./payments.js";
import mt5Router from "./mt5.js";
import tradingRouter from "./trading.js";

const router = Router();
router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/signals", signalsRouter);
router.use("/payments", paymentsRouter);
router.use("/mt5", mt5Router);
router.use("/trading", tradingRouter);

export default router;
