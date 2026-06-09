import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { getDashboard } from "../controllers/dashboardController";

const router = Router();

router.get("/", requireAuth, asyncHandler(getDashboard));

export default router;
