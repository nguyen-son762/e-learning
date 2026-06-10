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
    userId: topic.userId ?? null,
    flashcards,
  });
}

const progressSchema = z.object({
  known: z.boolean(),
  quality: z.number().int().min(0).max(5).optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_INTERVAL_DAYS = 180;

type SrsInput = {
  oldInterval: number;
  oldEaseFactor: number;
  oldRepetitions: number;
  known: boolean;
  quality: number;
  now: Date;
};

type SrsOutput = {
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReviewAt: Date;
};

// SM-2 scheduler (simplified per data-model v3).
function computeSrs(input: SrsInput): SrsOutput {
  const { oldInterval, oldEaseFactor, oldRepetitions, known, quality, now } = input;

  // Failing review (known=false OR quality<3) => relearn from interval=1.
  if (!known || quality < 3) {
    return {
      interval: 1,
      easeFactor: oldEaseFactor,
      repetitions: 0,
      nextReviewAt: new Date(now.getTime() + 1 * DAY_MS),
    };
  }

  const newEaseFactor = Math.max(
    1.3,
    oldEaseFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );

  let newInterval: number;
  if (oldRepetitions === 0) {
    newInterval = 1;
  } else if (oldRepetitions === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(oldInterval * newEaseFactor);
  }
  if (newInterval > MAX_INTERVAL_DAYS) newInterval = MAX_INTERVAL_DAYS;
  if (newInterval < 1) newInterval = 1;

  return {
    interval: newInterval,
    easeFactor: newEaseFactor,
    repetitions: oldRepetitions + 1,
    nextReviewAt: new Date(now.getTime() + newInterval * DAY_MS),
  };
}

// PUT /api/flashcards/:id/progress -> { flashcardId, known, updatedAt, nextReviewAt }
export async function updateFlashcardProgress(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;
  const body = parseBody(progressSchema, req.body);
  const quality = body.quality ?? 3;

  const card = await prisma.flashcard.findUnique({ where: { id } });
  if (!card) {
    throw new AppError("NOT_FOUND", "Không tìm thấy thẻ từ vựng.");
  }

  const existing = await prisma.flashcardProgress.findUnique({
    where: { userId_flashcardId: { userId, flashcardId: id } },
  });

  const now = new Date();
  const srs = computeSrs({
    oldInterval: existing?.interval ?? 1,
    oldEaseFactor: existing?.easeFactor ?? 2.5,
    oldRepetitions: existing?.repetitions ?? 0,
    known: body.known,
    quality,
    now,
  });

  const row = await prisma.flashcardProgress.upsert({
    where: { userId_flashcardId: { userId, flashcardId: id } },
    update: {
      known: body.known,
      interval: srs.interval,
      easeFactor: srs.easeFactor,
      repetitions: srs.repetitions,
      nextReviewAt: srs.nextReviewAt,
    },
    create: {
      userId,
      flashcardId: id,
      known: body.known,
      interval: srs.interval,
      easeFactor: srs.easeFactor,
      repetitions: srs.repetitions,
      nextReviewAt: srs.nextReviewAt,
    },
  });

  res.status(200).json({
    flashcardId: row.flashcardId,
    known: row.known,
    updatedAt: row.updatedAt.toISOString(),
    nextReviewAt: row.nextReviewAt ? row.nextReviewAt.toISOString() : null,
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

  // Flip all the user's known=true rows on cards in this topic to known=false,
  // and also reset the SRS state so cards re-enter the queue from scratch (v3).
  const result = await prisma.flashcardProgress.updateMany({
    where: {
      userId,
      flashcard: { topicId: topic.id },
    },
    data: {
      known: false,
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      nextReviewAt: null,
    },
  });

  res.status(200).json({
    slug: topic.slug,
    resetCount: result.count,
    knownCount: 0,
    completionPercent: 0,
  });
}

// v4 — Feature 7: user-created Topics & Flashcards.

const createTopicSchema = z.object({
  title: z.string().trim().min(1).max(80),
  titleVi: z.string().trim().min(1).max(80),
  description: z.string().optional(),
});

const updateTopicSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    titleVi: z.string().trim().min(1).max(80).optional(),
    description: z.string().nullable().optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.titleVi !== undefined ||
      v.description !== undefined,
    { message: "Cần ít nhất một trường để cập nhật." }
  );

const createFlashcardSchema = z.object({
  front: z.string().trim().min(1),
  back: z.string().trim().min(1),
  example: z.string().nullable().optional(),
});

const updateFlashcardSchema = z
  .object({
    front: z.string().trim().min(1).optional(),
    back: z.string().trim().min(1).optional(),
    example: z.string().nullable().optional(),
  })
  .refine(
    (v) =>
      v.front !== undefined ||
      v.back !== undefined ||
      v.example !== undefined,
    { message: "Cần ít nhất một trường để cập nhật." }
  );

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const candidate = base.length > 0 ? base : "topic";
  const exists = await prisma.topic.findUnique({ where: { slug: candidate } });
  if (!exists) return candidate;
  for (let i = 2; i <= 100; i++) {
    const next = `${candidate}-${i}`;
    const taken = await prisma.topic.findUnique({ where: { slug: next } });
    if (!taken) return next;
  }
  // Fallback: append timestamp suffix.
  return `${candidate}-${Date.now()}`;
}

// POST /api/topics -> 201 TopicSummary (single object)
export async function createTopic(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const body = parseBody(createTopicSchema, req.body);

  const slug = await uniqueSlug(slugify(body.title));

  const topic = await prisma.topic.create({
    data: {
      title: body.title.trim(),
      titleVi: body.titleVi.trim(),
      description: body.description ?? null,
      slug,
      userId,
      order: 0,
    },
  });

  res.status(201).json(toTopicSummary(topic, 0, 0));
}

// PUT /api/topics/:slug -> 200 TopicSummary
export async function updateTopic(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const { slug } = req.params;
  const body = parseBody(updateTopicSchema, req.body);

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: { _count: { select: { flashcards: true } } },
  });
  if (!topic) {
    throw new AppError("NOT_FOUND", "Không tìm thấy chủ đề.");
  }
  if (topic.userId === null || topic.userId !== userId) {
    throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  }

  const data: {
    title?: string;
    titleVi?: string;
    description?: string | null;
  } = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.titleVi !== undefined) data.titleVi = body.titleVi.trim();
  if (body.description !== undefined) data.description = body.description;

  const updated = await prisma.topic.update({
    where: { id: topic.id },
    data,
  });

  const knownCount = await prisma.flashcardProgress.count({
    where: { userId, known: true, flashcard: { topicId: topic.id } },
  });

  res.status(200).json(toTopicSummary(updated, topic._count.flashcards, knownCount));
}

// DELETE /api/topics/:slug -> 200 { success: true }
export async function deleteTopic(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const { slug } = req.params;

  const topic = await prisma.topic.findUnique({ where: { slug } });
  if (!topic) {
    throw new AppError("NOT_FOUND", "Không tìm thấy chủ đề.");
  }
  if (topic.userId === null || topic.userId !== userId) {
    throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  }

  await prisma.$transaction([
    prisma.flashcardProgress.deleteMany({
      where: { flashcard: { topicId: topic.id } },
    }),
    prisma.flashcard.deleteMany({ where: { topicId: topic.id } }),
    prisma.topic.delete({ where: { id: topic.id } }),
  ]);

  res.status(200).json({ success: true });
}

// POST /api/topics/:slug/flashcards -> 201 Flashcard
export async function createFlashcard(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const { slug } = req.params;
  const body = parseBody(createFlashcardSchema, req.body);

  const topic = await prisma.topic.findUnique({ where: { slug } });
  if (!topic) {
    throw new AppError("NOT_FOUND", "Không tìm thấy chủ đề.");
  }
  if (topic.userId === null || topic.userId !== userId) {
    throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  }

  const agg = await prisma.flashcard.aggregate({
    where: { topicId: topic.id },
    _max: { order: true },
  });
  const nextOrder = agg._max.order === null ? 0 : agg._max.order + 1;

  const card = await prisma.flashcard.create({
    data: {
      topicId: topic.id,
      front: body.front.trim(),
      back: body.back.trim(),
      example: body.example ?? null,
      order: nextOrder,
    },
  });

  res.status(201).json(toFlashcard(card, false));
}

// PUT /api/flashcards/:id -> 200 Flashcard
export async function updateFlashcard(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;
  const body = parseBody(updateFlashcardSchema, req.body);

  const card = await prisma.flashcard.findUnique({
    where: { id },
    include: { topic: { select: { userId: true } } },
  });
  if (!card) {
    throw new AppError("NOT_FOUND", "Không tìm thấy thẻ từ vựng.");
  }
  if (card.topic.userId === null || card.topic.userId !== userId) {
    throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  }

  const data: { front?: string; back?: string; example?: string | null } = {};
  if (body.front !== undefined) data.front = body.front.trim();
  if (body.back !== undefined) data.back = body.back.trim();
  if (body.example !== undefined) data.example = body.example;

  const updated = await prisma.flashcard.update({
    where: { id: card.id },
    data,
  });

  const progress = await prisma.flashcardProgress.findUnique({
    where: { userId_flashcardId: { userId, flashcardId: card.id } },
    select: { known: true },
  });

  res.status(200).json(toFlashcard(updated, progress?.known ?? false));
}

// DELETE /api/flashcards/:id -> 200 { success: true }
export async function deleteFlashcard(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;

  const card = await prisma.flashcard.findUnique({
    where: { id },
    include: { topic: { select: { userId: true } } },
  });
  if (!card) {
    throw new AppError("NOT_FOUND", "Không tìm thấy thẻ từ vựng.");
  }
  if (card.topic.userId === null || card.topic.userId !== userId) {
    throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  }

  await prisma.$transaction([
    prisma.flashcardProgress.deleteMany({ where: { flashcardId: card.id } }),
    prisma.flashcard.delete({ where: { id: card.id } }),
  ]);

  res.status(200).json({ success: true });
}

// GET /api/topics/:slug/review -> { items: Flashcard[], total, dueCount }   (v3)
export async function getTopicReview(
  req: Request,
  res: Response
): Promise<void> {
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
  const progressRows = await prisma.flashcardProgress.findMany({
    where: { userId, flashcardId: { in: cardIds } },
    select: { flashcardId: true, known: true, nextReviewAt: true },
  });
  const progressByCard = new Map(
    progressRows.map((r) => [r.flashcardId, r])
  );

  const now = new Date();

  // Due if no progress row, or progress row has null nextReviewAt, or nextReviewAt <= now.
  const due = topic.flashcards.filter((card) => {
    const p = progressByCard.get(card.id);
    if (!p) return true;
    if (p.nextReviewAt === null) return true;
    return p.nextReviewAt.getTime() <= now.getTime();
  });

  // Order: nextReviewAt ASC NULLS FIRST, then Flashcard.order ASC (already sorted from the query).
  due.sort((a, b) => {
    const pa = progressByCard.get(a.id);
    const pb = progressByCard.get(b.id);
    const aIsNull = !pa || pa.nextReviewAt === null;
    const bIsNull = !pb || pb.nextReviewAt === null;
    if (aIsNull && !bIsNull) return -1;
    if (!aIsNull && bIsNull) return 1;
    if (!aIsNull && !bIsNull) {
      const diff = pa!.nextReviewAt!.getTime() - pb!.nextReviewAt!.getTime();
      if (diff !== 0) return diff;
    }
    if (a.order !== b.order) return a.order - b.order;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const items = due.map((card) => {
    const p = progressByCard.get(card.id);
    return toFlashcard(card, p?.known ?? false);
  });

  res.status(200).json({
    items,
    total: items.length,
    dueCount: items.length,
  });
}
