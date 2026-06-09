-- CreateTable
CREATE TABLE IF NOT EXISTS "vocabulary_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "pronunciation" TEXT,
    "part_of_speech" TEXT,
    "synonyms" TEXT[],
    "antonyms" TEXT[],
    "example_sentence" TEXT,
    "notes" TEXT,
    "tags" TEXT[],
    "cefr_level" TEXT,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "known" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vocabulary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vocabulary_entries_user_id_created_at_idx" ON "vocabulary_entries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vocabulary_entries_user_id_word_idx" ON "vocabulary_entries"("user_id", "word");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vocabulary_entries_user_id_fkey'
    ) THEN
        ALTER TABLE "vocabulary_entries" ADD CONSTRAINT "vocabulary_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
