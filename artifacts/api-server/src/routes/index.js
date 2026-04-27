import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import mt5Router from "./mt5.js";
import tradingRouter from "./trading.js";
import paymentsRouter from "./payments.js";

const router = Router();
router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/mt5", mt5Router);
router.use("/trading", tradingRouter);
router.use("/payments", paymentsRouter);

export default router;
