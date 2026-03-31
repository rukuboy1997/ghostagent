import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import marketplaceRouter from "./marketplace";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(marketplaceRouter);

export default router;
