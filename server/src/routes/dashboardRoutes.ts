import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  getDashboard,
  getProgressHistory,
} from "../controllers/dashboardController";

const router = Router();

router.get("/", requireAuth, asyncHandler(getDashboard));
router.get("/progress-history", requireAuth, asyncHandler(getProgressHistory));

export default router;
