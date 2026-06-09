import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  listExercises,
  getExercise,
  createAttempt,
  listAttempts,
} from "../controllers/readingController";

const router = Router();

router.get("/", requireAuth, asyncHandler(listExercises));
router.get("/:slug", requireAuth, asyncHandler(getExercise));
router.post("/:slug/attempts", requireAuth, asyncHandler(createAttempt));
router.get("/:slug/attempts", requireAuth, asyncHandler(listAttempts));

export default router;
