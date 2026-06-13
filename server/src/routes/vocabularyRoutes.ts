import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  listVocabulary,
  listTags,
  createVocabulary,
  getVocabulary,
  updateVocabulary,
  deleteVocabulary,
  setFavorite,
  setProgress,
  mineVocabulary,
} from "../controllers/vocabularyController";

const router = Router();

// All vocabulary endpoints require auth and are owner-scoped.
// NOTE: /tags and /mine are declared before /:id so they are not captured as an id param.
router.get("/", requireAuth, asyncHandler(listVocabulary));
router.get("/tags", requireAuth, asyncHandler(listTags));
router.post("/mine", requireAuth, asyncHandler(mineVocabulary));
router.post("/", requireAuth, asyncHandler(createVocabulary));
router.get("/:id", requireAuth, asyncHandler(getVocabulary));
router.put("/:id", requireAuth, asyncHandler(updateVocabulary));
router.delete("/:id", requireAuth, asyncHandler(deleteVocabulary));
router.put("/:id/favorite", requireAuth, asyncHandler(setFavorite));
router.put("/:id/progress", requireAuth, asyncHandler(setProgress));

export default router;
