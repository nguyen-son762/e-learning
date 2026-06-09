import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  listTopics,
  getTopic,
  resetTopicProgress,
} from "../controllers/topicController";

const router = Router();

// All topic endpoints require auth (progress fields are per-user).
router.get("/", requireAuth, asyncHandler(listTopics));
router.get("/:slug", requireAuth, asyncHandler(getTopic));
router.post("/:slug/progress/reset", requireAuth, asyncHandler(resetTopicProgress));

export default router;
