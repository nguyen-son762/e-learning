import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { setLanguage } from "../controllers/userController";

const router = Router();

// v6 — language gate. Caller explicitly sets a language; never returns LANGUAGE_NOT_SELECTED.
router.put("/me/language", requireAuth, asyncHandler(setLanguage));

export default router;
