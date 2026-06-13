-- v7 gamification: streak/XP on users + persisted earned-badge log.

ALTER TABLE "users" ADD COLUMN "streak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "last_studied_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "total_xp" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "earned_badges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earned_badges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "earned_badges_user_id_badge_id_key" ON "earned_badges"("user_id", "badge_id");
CREATE INDEX "earned_badges_user_id_idx" ON "earned_badges"("user_id");

ALTER TABLE "earned_badges" ADD CONSTRAINT "earned_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
