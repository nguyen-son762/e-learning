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
} from "../controllers/vocabularyController";

const router = Router();

// All vocabulary endpoints require auth and are owner-scoped.
// NOTE: /tags is declared before /:id so it is not captured as an id param.
router.get("/", requireAuth, asyncHandler(listVocabulary));
router.get("/tags", requireAuth, asyncHandler(listTags));
router.post("/", requireAuth, asyncHandler(createVocabulary));
router.get("/:id", requireAuth, asyncHandler(getVocabulary));
router.put("/:id", requireAuth, asyncHandler(updateVocabulary));
router.delete("/:id", requireAuth, asyncHandler(deleteVocabulary));
router.put("/:id/favorite", requireAuth, asyncHandler(setFavorite));
router.put("/:id/progress", requireAuth, asyncHandler(setProgress));

export default router;
