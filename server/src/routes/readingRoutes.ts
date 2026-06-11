import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  listExercises,
  getExercise,
  createAttempt,
  listAttempts,
  createExercise,
  updateExercise,
  deleteExercise,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "../controllers/readingController";

const router = Router();

// Admin routes (v5) — must come before /:slug to avoid param shadowing on POST /
router.post("/", requireAuth, requireAdmin, asyncHandler(createExercise));

// Learner routes
router.get("/", requireAuth, asyncHandler(listExercises));
router.get("/:slug", requireAuth, asyncHandler(getExercise));
router.post("/:slug/attempts", requireAuth, asyncHandler(createAttempt));
router.get("/:slug/attempts", requireAuth, asyncHandler(listAttempts));

// Admin routes — slug-scoped
router.put("/:slug", requireAuth, requireAdmin, asyncHandler(updateExercise));
router.delete("/:slug", requireAuth, requireAdmin, asyncHandler(deleteExercise));
router.get("/:slug/questions", requireAuth, requireAdmin, asyncHandler(listQuestions));
router.post("/:slug/questions", requireAuth, requireAdmin, asyncHandler(createQuestion));
router.put("/:slug/questions/:id", requireAuth, requireAdmin, asyncHandler(updateQuestion));
router.delete("/:slug/questions/:id", requireAuth, requireAdmin, asyncHandler(deleteQuestion));

export default router;
