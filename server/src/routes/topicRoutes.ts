import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  listTopics,
  getTopic,
  getTopicReview,
  resetTopicProgress,
  createTopic,
  updateTopic,
  deleteTopic,
  createFlashcard,
} from "../controllers/topicController";

const router = Router();

// All topic endpoints require auth (progress fields are per-user).
router.get("/", requireAuth, asyncHandler(listTopics));
router.post("/", requireAuth, asyncHandler(createTopic));
router.get("/:slug", requireAuth, asyncHandler(getTopic));
router.put("/:slug", requireAuth, asyncHandler(updateTopic));
router.delete("/:slug", requireAuth, asyncHandler(deleteTopic));
router.get("/:slug/review", requireAuth, asyncHandler(getTopicReview));
router.post("/:slug/progress/reset", requireAuth, asyncHandler(resetTopicProgress));
router.post("/:slug/flashcards", requireAuth, asyncHandler(createFlashcard));

export default router;
