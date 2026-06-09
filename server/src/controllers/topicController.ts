import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { parseBody } from "../middleware/validate";
import { toTopicSummary, toFlashcard, completionPercent } from "../lib/serializers";

// GET /api/topics -> { items: TopicSummary[], total }
export async function listTopics(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;

  const topics = await prisma.topic.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { flashcards: true } } },
  });

  // Known counts per topic for this user (only known=true rows on cards in the topic).
  const known = await prisma.flashcardProgress.findMany({
    where: { userId, known: true, flashcard: {} },
    select: { flashcard: { select: { topicId: true } } },
  });
  const knownByTopic = new Map<string, number>();
  for (const row of known) {
    const tid = row.flashcard.topicId;
    knownByTopic.set(tid, (knownByTopic.get(tid) ?? 0) + 1);
  }

  const items = topics.map((t) =>
    toTopicSummary(t, t._count.flashcards, knownByTopic.get(t.id) ?? 0)
  );

  res.status(200).json({ items, total: items.length });
}

// GET /api/topics/:slug -> TopicDetail (single object, not wrapped)
export async function getTopic(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const { slug } = req.params;

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: {
      flashcards: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!topic) {
    throw new AppError("NOT_FOUND", "Không tìm thấy chủ đề.");
  }

  const cardIds = topic.flashcards.map((f) => f.id);
  const progress = await prisma.flashcardProgress.findMany({
    where: { userId, flashcardId: { in: cardIds } },
    select: { flashcardId: true, known: true },
  });
  const knownSet = new Set(
    progress.filter((p) => p.known).map((p) => p.flashcardId)
  );

  const flashcards = topic.flashcards.map((f) =>
    toFlashcard(f, knownSet.has(f.id))
  );
  const flashcardCount = topic.flashcards.length;
  const knownCount = knownSet.size;

  res.status(200).json({
    id: topic.id,
    slug: topic.slug,
    title: topic.title,
    titleVi: topic.titleVi,
    description: topic.description,
    flashcardCount,
    knownCount,
    completionPercent: completionPercent(knownCount, flashcardCount),
    flashcards,
  });
}

const progressSchema = z.object({ known: z.boolean() });

// PUT /api/flashcards/:id/progress -> { flashcardId, known, updatedAt }
export async function updateFlashcardProgress(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;
  const body = parseBody(progressSchema, req.body);

  const card = await prisma.flashcard.findUnique({ where: { id } });
  if (!card) {
    throw new AppError("NOT_FOUND", "Không tìm thấy thẻ từ vựng.");
  }

  const row = await prisma.flashcardProgress.upsert({
    where: { userId_flashcardId: { userId, flashcardId: id } },
    update: { known: body.known },
    create: { userId, flashcardId: id, known: body.known },
  });

  res.status(200).json({
    flashcardId: row.flashcardId,
    known: row.known,
    updatedAt: row.updatedAt.toISOString(),
  });
}

// POST /api/topics/:slug/progress/reset -> { slug, resetCount, knownCount, completionPercent }
export async function resetTopicProgress(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const { slug } = req.params;

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: { _count: { select: { flashcards: true } } },
  });
  if (!topic) {
    throw new AppError("NOT_FOUND", "Không tìm thấy chủ đề.");
  }

  // Flip all the user's known=true rows on cards in this topic to known=false.
  const result = await prisma.flashcardProgress.updateMany({
    where: {
      userId,
      known: true,
      flashcard: { topicId: topic.id },
    },
    data: { known: false },
  });

  res.status(200).json({
    slug: topic.slug,
    resetCount: result.count,
    knownCount: 0,
    completionPercent: 0,
  });
}
