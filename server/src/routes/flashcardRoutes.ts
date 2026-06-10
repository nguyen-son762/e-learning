import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  updateFlashcardProgress,
  updateFlashcard,
  deleteFlashcard,
} from "../controllers/topicController";

const router = Router();

router.put("/:id/progress", requireAuth, asyncHandler(updateFlashcardProgress));
router.put("/:id", requireAuth, asyncHandler(updateFlashcard));
router.delete("/:id", requireAuth, asyncHandler(deleteFlashcard));

export default router;
