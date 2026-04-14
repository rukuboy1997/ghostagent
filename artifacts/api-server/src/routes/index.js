import { Router } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import marketplaceRouter from "./marketplace";
import networkRouter from "./network";

const router = Router();
router.use(healthRouter);
router.use(agentsRouter);
router.use(marketplaceRouter);
router.use(networkRouter);

export default router;
