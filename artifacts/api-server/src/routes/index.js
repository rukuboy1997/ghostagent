import { Router } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import marketplaceRouter from "./marketplace";
const router = Router();
router.use(healthRouter);
router.use(agentsRouter);
router.use(marketplaceRouter);
var stdin_default = router;
export {
  stdin_default as default
};
