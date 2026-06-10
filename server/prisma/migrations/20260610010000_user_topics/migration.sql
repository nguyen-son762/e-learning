-- v4 — Feature 7: user-created Topics. Topic.userId nullable FK -> users.id.

-- AlterTable
ALTER TABLE "topics"
    ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- AddForeignKey (Postgres has no IF NOT EXISTS for ADD CONSTRAINT, so guard with DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'topics_user_id_fkey'
    ) THEN
        ALTER TABLE "topics"
            ADD CONSTRAINT "topics_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "topics_user_id_idx" ON "topics"("user_id");
