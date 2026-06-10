-- v3 — Add SM-2 SRS fields to FlashcardProgress.

-- AlterTable
ALTER TABLE "flashcard_progress"
    ADD COLUMN IF NOT EXISTS "interval" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "ease_factor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    ADD COLUMN IF NOT EXISTS "next_review_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "repetitions" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "flashcard_progress_user_id_next_review_at_idx" ON "flashcard_progress"("user_id", "next_review_at");
