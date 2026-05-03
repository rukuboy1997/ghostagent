import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import signalsRouter from "./signals.js";
import paymentsRouter from "./payments.js";

const router = Router();
router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/signals", signalsRouter);
router.use("/trading", signalsRouter);
router.use("/payments", paymentsRouter);

export default router;
