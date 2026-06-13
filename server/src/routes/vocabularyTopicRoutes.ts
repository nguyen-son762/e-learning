import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  listVocabularyTopics,
  createVocabularyTopic,
  updateVocabularyTopic,
  deleteVocabularyTopic,
} from "../controllers/vocabularyTopicController";

const router = Router();

// v8 — Personal Vocabulary Topics. All endpoints require auth and are owner-scoped.
router.get("/", requireAuth, asyncHandler(listVocabularyTopics));
router.post("/", requireAuth, asyncHandler(createVocabularyTopic));
router.patch("/:id", requireAuth, asyncHandler(updateVocabularyTopic));
router.delete("/:id", requireAuth, asyncHandler(deleteVocabularyTopic));

export default router;
