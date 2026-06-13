import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { parseBody } from "../middleware/validate";
import { toVocabularyEntry } from "../lib/serializers";
import {
  resolveListLanguage,
  resolveCreateLanguage,
  type Language,
} from "../lib/language";

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
  // v6 — Chinese-specific.
  pinyin: z.string().optional(),
  hskLevel: z.number().int().min(1).max(6).optional(),
  language: z.enum(["en", "zh"]).optional(),
  // PUT may also set the flags; if omitted they are left unchanged (handled below).
  isFavorite: z.boolean().optional(),
  known: z.boolean().optional(),
});

type EntryBody = {
  cefrLevel?: string | undefined;
  pinyin?: string | undefined;
  hskLevel?: number | undefined;
};

// v6 — per-language field validity. zh: cefrLevel must be absent/null; en: pinyin/hskLevel must be absent/null.
function assertLanguageFields(language: Language, body: EntryBody): void {
  if (language === "zh") {
    if (body.cefrLevel) {
      throw new AppError(
        "VALIDATION_ERROR",
        "cefrLevel chỉ áp dụng khi language='en'."
      );
    }
  } else {
    if (body.pinyin !== undefined && body.pinyin !== null) {
      throw new AppError(
        "VALIDATION_ERROR",
        "pinyin chỉ áp dụng khi language='zh'."
      );
    }
    if (body.hskLevel !== undefined && body.hskLevel !== null) {
      throw new AppError(
        "VALIDATION_ERROR",
        "hskLevel chỉ áp dụng khi language='zh'."
      );
    }
  }
}

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
// v6 — accepts ?language=en|zh; defaults to user.language (403 LANGUAGE_NOT_SELECTED if null).
export async function listVocabulary(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const language = await resolveListLanguage(userId, req.query.language);

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
  const partOfSpeech =
    typeof req.query.partOfSpeech === "string" ? req.query.partOfSpeech.trim() : "";
  const favorite = typeof req.query.favorite === "string" ? req.query.favorite : "";
  const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";

  const where: Record<string, unknown> = { userId, language };

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
// v6 — accepts ?language=en|zh; defaults to user.language (403 LANGUAGE_NOT_SELECTED if null).
export async function listTags(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const language = await resolveListLanguage(userId, req.query.language);

  const entries = await prisma.vocabularyEntry.findMany({
    where: { userId, language },
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
// v6 — language: from body if present, else inherit from user.language; pinyin/hskLevel valid only for zh.
export async function createVocabulary(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const body = parseBody(entryBodySchema, req.body);
  const language = await resolveCreateLanguage(userId, body.language);
  assertLanguageFields(language, body);

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
      cefrLevel: language === "en" ? body.cefrLevel ?? null : null,
      pinyin: language === "zh" ? body.pinyin ?? null : null,
      hskLevel: language === "zh" ? body.hskLevel ?? null : null,
      language,
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
// v6 — language is immutable post-create (the entry's slot lives in one language); body language must match.
export async function updateVocabulary(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const existing = await getOwnedEntry(req.params.id, userId);
  const body = parseBody(entryBodySchema, req.body);

  const language: Language = existing.language === "zh" ? "zh" : "en";
  if (body.language !== undefined && body.language !== language) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Không thể đổi ngôn ngữ của một từ vựng đã tạo."
    );
  }
  assertLanguageFields(language, body);

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
      cefrLevel: language === "en" ? body.cefrLevel ?? null : null,
      pinyin: language === "zh" ? body.pinyin ?? null : null,
      hskLevel: language === "zh" ? body.hskLevel ?? null : null,
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
