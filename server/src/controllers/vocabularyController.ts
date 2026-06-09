import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { parseBody } from "../middleware/validate";
import { toVocabularyEntry } from "../lib/serializers";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

// Shared body schema for create (POST) and full-replace (PUT).
// word/meaning required + non-empty (trimmed); optional scalars optional;
// arrays default to []; cefrLevel constrained to the CEFR set.
const stringArray = z.array(z.string()).optional().default([]);

const entryBodySchema = z.object({
  word: z.string().trim().min(1, "word không được để trống."),
  meaning: z.string().trim().min(1, "meaning không được để trống."),
  pronunciation: z.string().optional(),
  partOfSpeech: z.string().optional(),
  synonyms: stringArray,
  antonyms: stringArray,
  exampleSentence: z.string().optional(),
  notes: z.string().optional(),
  tags: stringArray,
  cefrLevel: z.enum(CEFR_LEVELS).optional(),
  // PUT may also set the flags; if omitted they are left unchanged (handled below).
  isFavorite: z.boolean().optional(),
  known: z.boolean().optional(),
});

const favoriteSchema = z.object({ isFavorite: z.boolean() });
const progressSchema = z.object({ known: z.boolean() });

// Load an entry owned by the authed user, else 404 (existence never leaked).
async function getOwnedEntry(id: string, userId: string) {
  const entry = await prisma.vocabularyEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== userId) {
    throw new AppError("NOT_FOUND", "Không tìm thấy từ vựng.");
  }
  return entry;
}

// GET /api/vocabulary -> { items: VocabularyEntry[], total }
export async function listVocabulary(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
  const partOfSpeech =
    typeof req.query.partOfSpeech === "string" ? req.query.partOfSpeech.trim() : "";
  const favorite = typeof req.query.favorite === "string" ? req.query.favorite : "";
  const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";

  const where: Record<string, unknown> = { userId };

  if (search) {
    where.OR = [
      { word: { contains: search, mode: "insensitive" } },
      { meaning: { contains: search, mode: "insensitive" } },
    ];
  }
  if (tag) where.tags = { has: tag };
  if (partOfSpeech) where.partOfSpeech = partOfSpeech;
  if (favorite === "true") where.isFavorite = true;
  else if (favorite === "false") where.isFavorite = false;

  const orderBy =
    sort === "oldest"
      ? { createdAt: "asc" as const }
      : sort === "az"
      ? { word: "asc" as const }
      : { createdAt: "desc" as const };

  const entries = await prisma.vocabularyEntry.findMany({ where, orderBy });
  const items = entries.map(toVocabularyEntry);
  res.status(200).json({ items, total: items.length });
}

// GET /api/vocabulary/tags -> { items: string[], total } (distinct, alpha case-insensitive)
export async function listTags(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;

  const entries = await prisma.vocabularyEntry.findMany({
    where: { userId },
    select: { tags: true },
  });

  const seen = new Map<string, string>();
  for (const e of entries) {
    for (const t of e.tags) {
      const key = t.toLowerCase();
      if (!seen.has(key)) seen.set(key, t);
    }
  }
  const items = Array.from(seen.values()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  res.status(200).json({ items, total: items.length });
}

// POST /api/vocabulary -> 201 VocabularyEntry
export async function createVocabulary(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const body = parseBody(entryBodySchema, req.body);

  const created = await prisma.vocabularyEntry.create({
    data: {
      userId,
      word: body.word,
      meaning: body.meaning,
      pronunciation: body.pronunciation ?? null,
      partOfSpeech: body.partOfSpeech ?? null,
      synonyms: body.synonyms,
      antonyms: body.antonyms,
      exampleSentence: body.exampleSentence ?? null,
      notes: body.notes ?? null,
      tags: body.tags,
      cefrLevel: body.cefrLevel ?? null,
      // isFavorite/known set server-side; ignore any in-body values on create.
      isFavorite: false,
      known: false,
    },
  });

  res.status(201).json(toVocabularyEntry(created));
}

// GET /api/vocabulary/:id -> VocabularyEntry
export async function getVocabulary(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const entry = await getOwnedEntry(req.params.id, userId);
  res.status(200).json(toVocabularyEntry(entry));
}

// PUT /api/vocabulary/:id -> VocabularyEntry (full replacement of editable fields)
export async function updateVocabulary(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  await getOwnedEntry(req.params.id, userId);
  const body = parseBody(entryBodySchema, req.body);

  const updated = await prisma.vocabularyEntry.update({
    where: { id: req.params.id },
    data: {
      word: body.word,
      meaning: body.meaning,
      pronunciation: body.pronunciation ?? null,
      partOfSpeech: body.partOfSpeech ?? null,
      synonyms: body.synonyms,
      antonyms: body.antonyms,
      exampleSentence: body.exampleSentence ?? null,
      notes: body.notes ?? null,
      tags: body.tags,
      cefrLevel: body.cefrLevel ?? null,
      // Flags applied if present; omitted -> left unchanged (not reset).
      ...(body.isFavorite !== undefined ? { isFavorite: body.isFavorite } : {}),
      ...(body.known !== undefined ? { known: body.known } : {}),
    },
  });

  res.status(200).json(toVocabularyEntry(updated));
}

// DELETE /api/vocabulary/:id -> 200 { success: true }
export async function deleteVocabulary(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  await getOwnedEntry(req.params.id, userId);
  await prisma.vocabularyEntry.delete({ where: { id: req.params.id } });
  res.status(200).json({ success: true });
}

// PUT /api/vocabulary/:id/favorite -> { id, isFavorite } (idempotent set)
export async function setFavorite(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  await getOwnedEntry(req.params.id, userId);
  const { isFavorite } = parseBody(favoriteSchema, req.body);

  const updated = await prisma.vocabularyEntry.update({
    where: { id: req.params.id },
    data: { isFavorite },
    select: { id: true, isFavorite: true },
  });
  res.status(200).json({ id: updated.id, isFavorite: updated.isFavorite });
}

// PUT /api/vocabulary/:id/progress -> { id, known } (idempotent set)
export async function setProgress(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  await getOwnedEntry(req.params.id, userId);
  const { known } = parseBody(progressSchema, req.body);

  const updated = await prisma.vocabularyEntry.update({
    where: { id: req.params.id },
    data: { known },
    select: { id: true, known: true },
  });
  res.status(200).json({ id: updated.id, known: updated.known });
}
