-- v6 — Multi-language (Chinese Learning Module).
-- Adds `language` to User (nullable), Topic, ReadingExercise, VocabularyEntry (with "en" default).
-- Adds `pinyin`, `hsk_level` to VocabularyEntry. Swaps slug-global unique for (slug, language) compound.

-- AlterTable: User
ALTER TABLE "users" ADD COLUMN "language" TEXT;

-- AlterTable: Topic
ALTER TABLE "topics" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';

-- AlterTable: ReadingExercise
ALTER TABLE "reading_exercises" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';

-- AlterTable: VocabularyEntry
ALTER TABLE "vocabulary_entries" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "vocabulary_entries" ADD COLUMN "pinyin" TEXT;
ALTER TABLE "vocabulary_entries" ADD COLUMN "hsk_level" INTEGER;

-- Replace global unique slug with (slug, language) compound unique on Topic
DROP INDEX IF EXISTS "topics_slug_key";
CREATE UNIQUE INDEX "topics_slug_language_key" ON "topics"("slug", "language");
CREATE INDEX "topics_language_idx" ON "topics"("language");

-- Replace global unique slug with (slug, language) compound unique on ReadingExercise
DROP INDEX IF EXISTS "reading_exercises_slug_key";
CREATE UNIQUE INDEX "reading_exercises_slug_language_key" ON "reading_exercises"("slug", "language");
CREATE INDEX "reading_exercises_language_idx" ON "reading_exercises"("language");

-- Index for filtering vocabulary by (userId, language)
CREATE INDEX "vocabulary_entries_user_id_language_idx" ON "vocabulary_entries"("user_id", "language");

-- Explicit backfill (DEFAULT 'en' already covers existing rows on the new columns, but make it explicit
-- so the migration is self-documenting and idempotent against any rows inserted between ADD COLUMN and now).
UPDATE "topics" SET "language" = 'en' WHERE "language" IS NULL;
UPDATE "reading_exercises" SET "language" = 'en' WHERE "language" IS NULL;
UPDATE "vocabulary_entries" SET "language" = 'en' WHERE "language" IS NULL;
-- Per brief AC: existing users get auto-set to "en" for backward compatibility.
-- New users (post-migration) register with language=null and are routed through /choose-language.
UPDATE "users" SET "language" = 'en' WHERE "language" IS NULL;
