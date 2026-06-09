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
