import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { updateFlashcardProgress } from "../controllers/topicController";

const router = Router();

router.put("/:id/progress", requireAuth, asyncHandler(updateFlashcardProgress));

export default router;
