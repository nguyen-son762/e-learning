import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
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
