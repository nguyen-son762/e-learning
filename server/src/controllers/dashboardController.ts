import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { toTopicSummary, completionPercent } from "../lib/serializers";

// GET /api/dashboard -> { totals, topicProgress: {items,total}, recentAttempts: {items,total} }
export async function getDashboard(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;

  const topics = await prisma.topic.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { flashcards: true } } },
  });

  const knownRows = await prisma.flashcardProgress.findMany({
    where: { userId, known: true },
    select: { flashcard: { select: { topicId: true } } },
  });
  const knownByTopic = new Map<string, number>();
  for (const row of knownRows) {
    const tid = row.flashcard.topicId;
    knownByTopic.set(tid, (knownByTopic.get(tid) ?? 0) + 1);
  }

  const topicSummaries = topics.map((t) =>
    toTopicSummary(t, t._count.flashcards, knownByTopic.get(t.id) ?? 0)
  );

  const flashcardCount = topicSummaries.reduce((a, t) => a + t.flashcardCount, 0);
  const knownCount = topicSummaries.reduce((a, t) => a + t.knownCount, 0);

  const readingAttemptCount = await prisma.readingAttempt.count({
    where: { userId },
  });

  const recent = await prisma.readingAttempt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { exercise: { select: { slug: true, title: true } } },
  });

  res.status(200).json({
    totals: {
      topicCount: topics.length,
      flashcardCount,
      knownCount,
      overallCompletionPercent: completionPercent(knownCount, flashcardCount),
      readingAttemptCount,
    },
    topicProgress: {
      items: topicSummaries,
      total: topicSummaries.length,
    },
    recentAttempts: {
      items: recent.map((a) => ({
        id: a.id,
        exerciseId: a.exerciseId,
        exerciseSlug: a.exercise.slug,
        exerciseTitle: a.exercise.title,
        score: a.score,
        total: a.total,
        createdAt: a.createdAt.toISOString(),
      })),
      total: readingAttemptCount,
    },
  });
}

// GET /api/dashboard/progress-history?days=7|30 -> { items: [{date, count}], total }   (v3)
// Daily count of distinct flashcards the user marked known=true on each UTC day,
// zero-filled to exactly `days` items, oldest → newest.
export async function getProgressHistory(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;

  // Strict allowlist: days ∈ {7, 30}, default 7.
  const raw = req.query.days;
  let days = 7;
  if (raw !== undefined) {
    const asString = String(raw);
    if (asString !== "7" && asString !== "30") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Tham số 'days' chỉ chấp nhận 7 hoặc 30."
      );
    }
    days = Number(asString);
  }

  // UTC date window: today (UTC) inclusive, back `days - 1` days.
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const start = new Date(today.getTime());
  start.setUTCDate(start.getUTCDate() - (days - 1));
  // windowEnd is exclusive: start of tomorrow (UTC).
  const windowEnd = new Date(today.getTime());
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

  const rows = await prisma.flashcardProgress.findMany({
    where: {
      userId,
      known: true,
      updatedAt: { gte: start, lt: windowEnd },
    },
    select: { flashcardId: true, updatedAt: true },
  });

  // Dedup per (flashcardId, utcDate); count once per card per day.
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const row of rows) {
    const d = row.updatedAt;
    const utcDate = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    const dedupKey = `${row.flashcardId}|${utcDate}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    counts.set(utcDate, (counts.get(utcDate) ?? 0) + 1);
  }

  // Zero-fill exactly `days` items, oldest first.
  const items: Array<{ date: string; count: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    items.push({ date: dateStr, count: counts.get(dateStr) ?? 0 });
  }

  res.status(200).json({ items, total: days });
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
