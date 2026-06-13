// v7 — Gamification: XP, streak, and badge rules.
// Wire-level quality is 0..3 (Again/Hard/Good/Easy); mapped to SM-2 0/3/4/5 server-side.
// XP awards per rating: Again=0, Hard=5, Good=10, Easy=15.
// Streak rule: previous UTC day -> +=1; same UTC day -> unchanged; otherwise -> reset to 1.
// Streak advances only on quality >= Hard (>=1); Again (0) still updates lastStudiedAt.
// Badges (server-detected, persisted on first earn): first-review / week-streak / century-xp.

import type { EarnedBadge as PrismaEarnedBadge } from "@prisma/client";

export type WireQuality = 0 | 1 | 2 | 3;

export function isWireQuality(v: unknown): v is WireQuality {
  return v === 0 || v === 1 || v === 2 || v === 3;
}

// Map the 4-value wire quality to SM-2's 0/3/4/5 used by the existing SM-2 scheduler.
export function wireToSm2Quality(q: WireQuality): 0 | 3 | 4 | 5 {
  switch (q) {
    case 0:
      return 0; // Again
    case 1:
      return 3; // Hard
    case 2:
      return 4; // Good
    case 3:
      return 5; // Easy
  }
}

const XP_BY_WIRE_QUALITY: Record<WireQuality, number> = {
  0: 0,
  1: 5,
  2: 10,
  3: 15,
};

export function xpForQuality(q: WireQuality): number {
  return XP_BY_WIRE_QUALITY[q];
}

// UTC midnight for the given moment.
function utcDayStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

// Returns true iff `a` and `b` fall on the same UTC calendar date.
function sameUtcDay(a: Date, b: Date): boolean {
  return utcDayStart(a).getTime() === utcDayStart(b).getTime();
}

// Returns true iff `a` is on the UTC calendar day immediately before `b`'s UTC day.
function isPreviousUtcDay(a: Date, b: Date): boolean {
  const bStart = utcDayStart(b);
  const dayBefore = new Date(bStart.getTime());
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  return sameUtcDay(a, dayBefore);
}

export type StreakInput = {
  currentStreak: number;
  lastStudiedAt: Date | null;
  quality: WireQuality;
  now: Date;
};

// Per the v7 contract: streak only advances on quality >= Hard (>= 1).
// - Quality 0 (Again): lastStudiedAt is still updated, streak is left unchanged.
// - Quality >= 1: apply the UTC-day rule against lastStudiedAt.
export function computeNewStreak({
  currentStreak,
  lastStudiedAt,
  quality,
  now,
}: StreakInput): number {
  if (quality === 0) return currentStreak;

  if (lastStudiedAt === null) return 1;

  if (sameUtcDay(lastStudiedAt, now)) return currentStreak;

  if (isPreviousUtcDay(lastStudiedAt, now)) return currentStreak + 1;

  // Older than yesterday => reset, today counts as 1.
  return 1;
}

// Badge catalog. Vietnamese labels per the v7 contract.
export type BadgeId = "first-review" | "week-streak" | "century-xp";

export const BADGE_LABELS: Record<BadgeId, string> = {
  "first-review": "Đánh giá đầu tiên",
  "week-streak": "7 ngày liên tiếp",
  "century-xp": "100 XP",
};

// Determine which badges the user has newly earned given the post-update stats.
// `firstReviewEver` is true iff this is the user's first ever SRS-rating call.
export function detectNewlyEarnedBadges(input: {
  alreadyEarned: Set<string>;
  totalXP: number;
  streak: number;
  firstReviewEver: boolean;
}): BadgeId[] {
  const earned: BadgeId[] = [];
  if (input.firstReviewEver && !input.alreadyEarned.has("first-review")) {
    earned.push("first-review");
  }
  if (input.streak >= 7 && !input.alreadyEarned.has("week-streak")) {
    earned.push("week-streak");
  }
  if (input.totalXP >= 100 && !input.alreadyEarned.has("century-xp")) {
    earned.push("century-xp");
  }
  return earned;
}

// Serialize a persisted EarnedBadge row into the contract's Badge shape.
export function toBadge(b: PrismaEarnedBadge) {
  const id = b.badgeId as BadgeId;
  return {
    id,
    label: BADGE_LABELS[id] ?? b.badgeId,
    earnedAt: b.earnedAt.toISOString(),
  };
}
