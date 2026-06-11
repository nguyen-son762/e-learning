import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { parseBody } from "../middleware/validate";
import {
  toReadingExerciseSummary,
  toReadingQuestionPublic,
  toReadingQuestionGraded,
  toReadingAttempt,
  toReadingQuestionAdmin,
} from "../lib/serializers";

// GET /api/reading-exercises -> { items: ReadingExerciseSummary[], total }
export async function listExercises(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;

  const exercises = await prisma.readingExercise.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { questions: true } } },
  });

  // Best score per exercise for this user.
  const grouped = await prisma.readingAttempt.groupBy({
    by: ["exerciseId"],
    where: { userId },
    _max: { score: true },
  });
  const bestByExercise = new Map<string, number>();
  for (const g of grouped) {
    if (g._max.score !== null) bestByExercise.set(g.exerciseId, g._max.score);
  }

  const items = exercises.map((e) =>
    toReadingExerciseSummary(
      e,
      e._count.questions,
      bestByExercise.has(e.id) ? bestByExercise.get(e.id)! : null
    )
  );

  res.status(200).json({ items, total: items.length });
}

// GET /api/reading-exercises/:slug -> ReadingExerciseDetail (NO correctIndex on questions)
export async function getExercise(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;

  const exercise = await prisma.readingExercise.findUnique({
    where: { slug },
    include: { questions: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });
  if (!exercise) {
    throw new AppError("NOT_FOUND", "Không tìm thấy bài đọc.");
  }

  res.status(200).json({
    id: exercise.id,
    slug: exercise.slug,
    title: exercise.title,
    level: exercise.level,
    passage: exercise.passage,
    questions: exercise.questions.map(toReadingQuestionPublic),
  });
}

const attemptSchema = z.object({
  answers: z.array(z.number().int().gte(-1)),
});

// POST /api/reading-exercises/:slug/attempts -> 201 ReadingAttemptResult (graded, with correctIndex)
export async function createAttempt(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const { slug } = req.params;
  const body = parseBody(attemptSchema, req.body);

  const exercise = await prisma.readingExercise.findUnique({
    where: { slug },
    include: { questions: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });
  if (!exercise) {
    throw new AppError("NOT_FOUND", "Không tìm thấy bài đọc.");
  }

  const questions = exercise.questions;
  const total = questions.length;

  if (body.answers.length !== total) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Số câu trả lời (${body.answers.length}) phải bằng số câu hỏi (${total}).`
    );
  }

  // Validate each index against that question's options (-1 allowed = unanswered).
  for (let i = 0; i < total; i++) {
    const ans = body.answers[i];
    const optCount = questions[i].options.length;
    if (ans !== -1 && (ans < 0 || ans >= optCount)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Đáp án câu ${i + 1} nằm ngoài phạm vi lựa chọn.`
      );
    }
  }

  // Grade against stored correctIndex.
  let score = 0;
  const gradedQuestions = questions.map((q, i) => {
    const selectedIndex = body.answers[i];
    if (selectedIndex === q.correctIndex) score++;
    return toReadingQuestionGraded(q, selectedIndex);
  });

  const attempt = await prisma.readingAttempt.create({
    data: {
      userId,
      exerciseId: exercise.id,
      answers: body.answers,
      score,
      total,
    },
  });

  res.status(201).json({
    id: attempt.id,
    exerciseId: attempt.exerciseId,
    score: attempt.score,
    total: attempt.total,
    createdAt: attempt.createdAt.toISOString(),
    questions: gradedQuestions,
  });
}

// GET /api/reading-exercises/:slug/attempts -> { items: ReadingAttempt[], total } (newest first)
export async function listAttempts(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const { slug } = req.params;

  const exercise = await prisma.readingExercise.findUnique({ where: { slug } });
  if (!exercise) {
    throw new AppError("NOT_FOUND", "Không tìm thấy bài đọc.");
  }

  const attempts = await prisma.readingAttempt.findMany({
    where: { userId, exerciseId: exercise.id },
    orderBy: { createdAt: "desc" },
  });

  const items = attempts.map(toReadingAttempt);
  res.status(200).json({ items, total: items.length });
}

// --- Admin controllers (v5) ---

function makeSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const exerciseCreateSchema = z.object({
  title: z.string().trim().min(1),
  level: z.string().trim().min(1),
  passage: z.string().trim().min(1),
  questions: z
    .array(
      z.object({
        prompt: z.string().trim().min(1),
        options: z.array(z.string()).min(2),
        correctIndex: z.number().int().min(0),
        order: z.number().int().min(0).optional(),
      })
    )
    .min(1),
});

const exerciseUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  level: z.string().trim().min(1).optional(),
  passage: z.string().trim().min(1).optional(),
});

const questionCreateSchema = z.object({
  prompt: z.string().trim().min(1),
  options: z.array(z.string()).min(2),
  correctIndex: z.number().int().min(0),
  order: z.number().int().min(0).optional(),
});

const questionUpdateSchema = z.object({
  prompt: z.string().trim().min(1).optional(),
  options: z.array(z.string()).min(2).optional(),
  correctIndex: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
});

// POST /api/reading-exercises -> 201 ReadingExerciseSummary (admin only)
export async function createExercise(req: Request, res: Response): Promise<void> {
  const body = parseBody(exerciseCreateSchema, req.body);

  let slug = makeSlug(body.title);
  let suffix = 2;
  while (await prisma.readingExercise.findUnique({ where: { slug } })) {
    slug = `${makeSlug(body.title)}-${suffix++}`;
  }

  const maxOrder = await prisma.readingExercise.aggregate({ _max: { order: true } });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const exercise = await prisma.readingExercise.create({
    data: {
      slug,
      title: body.title,
      level: body.level,
      passage: body.passage,
      order: nextOrder,
      questions: {
        create: body.questions.map((q, i) => ({
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
          order: q.order ?? i,
        })),
      },
    },
    include: { _count: { select: { questions: true } } },
  });

  res.status(201).json(toReadingExerciseSummary(exercise, exercise._count.questions, null));
}

// PUT /api/reading-exercises/:slug -> 200 ReadingExerciseSummary (admin only)
export async function updateExercise(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  const body = parseBody(exerciseUpdateSchema, req.body);
  const userId = req.userId!;

  const existing = await prisma.readingExercise.findUnique({ where: { slug } });
  if (!existing) throw new AppError("NOT_FOUND", "Không tìm thấy bài đọc.");

  const updated = await prisma.readingExercise.update({
    where: { slug },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.level !== undefined && { level: body.level }),
      ...(body.passage !== undefined && { passage: body.passage }),
    },
    include: { _count: { select: { questions: true } } },
  });

  const grouped = await prisma.readingAttempt.groupBy({
    by: ["exerciseId"],
    where: { userId, exerciseId: updated.id },
    _max: { score: true },
  });
  const bestScore = grouped[0]?._max.score ?? null;

  res.status(200).json(toReadingExerciseSummary(updated, updated._count.questions, bestScore));
}

// DELETE /api/reading-exercises/:slug -> 200 { success: true } (admin only)
export async function deleteExercise(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;

  const existing = await prisma.readingExercise.findUnique({ where: { slug } });
  if (!existing) throw new AppError("NOT_FOUND", "Không tìm thấy bài đọc.");

  await prisma.readingExercise.delete({ where: { slug } });

  res.status(200).json({ success: true });
}

// POST /api/reading-exercises/:slug/questions -> 201 ReadingQuestionAdmin (admin only)
export async function createQuestion(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  const body = parseBody(questionCreateSchema, req.body);

  const exercise = await prisma.readingExercise.findUnique({ where: { slug } });
  if (!exercise) throw new AppError("NOT_FOUND", "Không tìm thấy bài đọc.");

  if (body.correctIndex >= body.options.length) {
    throw new AppError("VALIDATION_ERROR", "correctIndex vượt quá số lượng options.");
  }

  const maxOrder = await prisma.readingQuestion.aggregate({
    where: { exerciseId: exercise.id },
    _max: { order: true },
  });
  const nextOrder = body.order ?? (maxOrder._max.order ?? -1) + 1;

  const question = await prisma.readingQuestion.create({
    data: {
      exerciseId: exercise.id,
      prompt: body.prompt,
      options: body.options,
      correctIndex: body.correctIndex,
      order: nextOrder,
    },
  });

  res.status(201).json(toReadingQuestionAdmin(question));
}

// PUT /api/reading-exercises/:slug/questions/:id -> 200 ReadingQuestionAdmin (admin only)
export async function updateQuestion(req: Request, res: Response): Promise<void> {
  const { slug, id } = req.params;
  const body = parseBody(questionUpdateSchema, req.body);

  const exercise = await prisma.readingExercise.findUnique({ where: { slug } });
  if (!exercise) throw new AppError("NOT_FOUND", "Không tìm thấy bài đọc.");

  const existing = await prisma.readingQuestion.findFirst({
    where: { id, exerciseId: exercise.id },
  });
  if (!existing) throw new AppError("NOT_FOUND", "Không tìm thấy câu hỏi.");

  const newOptions = body.options ?? (existing.options as string[]);
  const newCorrectIndex = body.correctIndex ?? existing.correctIndex;
  if (newCorrectIndex >= newOptions.length) {
    throw new AppError("VALIDATION_ERROR", "correctIndex vượt quá số lượng options.");
  }

  const updated = await prisma.readingQuestion.update({
    where: { id },
    data: {
      ...(body.prompt !== undefined && { prompt: body.prompt }),
      ...(body.options !== undefined && { options: body.options }),
      ...(body.correctIndex !== undefined && { correctIndex: body.correctIndex }),
      ...(body.order !== undefined && { order: body.order }),
    },
  });

  res.status(200).json(toReadingQuestionAdmin(updated));
}

// GET /api/reading-exercises/:slug/questions -> { items: ReadingQuestionAdmin[], total } (admin only)
export async function listQuestions(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;

  const exercise = await prisma.readingExercise.findUnique({ where: { slug } });
  if (!exercise) throw new AppError("NOT_FOUND", "Không tìm thấy bài đọc.");

  const questions = await prisma.readingQuestion.findMany({
    where: { exerciseId: exercise.id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const items = questions.map(toReadingQuestionAdmin);
  res.status(200).json({ items, total: items.length });
}

// DELETE /api/reading-exercises/:slug/questions/:id -> 200 { success: true } (admin only)
export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  const { slug, id } = req.params;

  const exercise = await prisma.readingExercise.findUnique({ where: { slug } });
  if (!exercise) throw new AppError("NOT_FOUND", "Không tìm thấy bài đọc.");

  const existing = await prisma.readingQuestion.findFirst({
    where: { id, exerciseId: exercise.id },
  });
  if (!existing) throw new AppError("NOT_FOUND", "Không tìm thấy câu hỏi.");

  await prisma.readingQuestion.delete({ where: { id } });

  res.status(200).json({ success: true });
}
