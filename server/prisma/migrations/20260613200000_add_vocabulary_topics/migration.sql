-- v8 — Personal Vocabulary Topics.
-- Adds vocabulary_topics table + nullable vocabulary_topic_id FK on vocabulary_entries.
-- Forward-only; pre-v8 rows backfill to NULL (untagged); vocabulary_topics starts empty.
-- Topic (v4 flashcard bucket) and VocabularyEntry.tags[] are NOT touched.

-- New table: vocabulary_topics
CREATE TABLE "vocabulary_topics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vocabulary_topics_pkey" PRIMARY KEY ("id")
);

-- Uniqueness boundary: a user cannot have two topics with the same name in the same language.
CREATE UNIQUE INDEX "vocabulary_topics_user_id_language_name_key" ON "vocabulary_topics"("user_id", "language", "name");
CREATE INDEX "vocabulary_topics_user_id_language_idx" ON "vocabulary_topics"("user_id", "language");

ALTER TABLE "vocabulary_topics"
    ADD CONSTRAINT "vocabulary_topics_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend vocabulary_entries: nullable FK + (userId, vocabularyTopicId) index.
ALTER TABLE "vocabulary_entries" ADD COLUMN "vocabulary_topic_id" TEXT;

CREATE INDEX "vocabulary_entries_user_id_vocabulary_topic_id_idx" ON "vocabulary_entries"("user_id", "vocabulary_topic_id");

ALTER TABLE "vocabulary_entries"
    ADD CONSTRAINT "vocabulary_entries_vocabulary_topic_id_fkey"
    FOREIGN KEY ("vocabulary_topic_id") REFERENCES "vocabulary_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
