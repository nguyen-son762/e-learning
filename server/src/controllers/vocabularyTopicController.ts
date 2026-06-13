import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { parseBody } from "../middleware/validate";
import { toVocabularyTopic } from "../lib/serializers";
import {
  resolveListLanguage,
  resolveCreateLanguage,
  type Language,
} from "../lib/language";

// v8 — Personal Vocabulary Topics. Per-user, per-language labels users attach to vocab entries.
// All endpoints are owner-scoped; non-owner access to an existing topic returns 404 (existence
// is never leaked) per the v2 vocabulary-entry rule.

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const NAME_MAX = 60;

// POST body: name required (trimmed, 1–60); color optional hex or null; language optional.
const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "name không được để trống.")
    .max(NAME_MAX, `name không được dài quá ${NAME_MAX} ký tự.`),
  color: z
    .union([z.string().regex(HEX_COLOR, "color phải có dạng #RRGGBB."), z.null()])
    .optional(),
  language: z.enum(["en", "zh"]).optional(),
});

// PATCH body: name?/color? — only provided fields are updated. language is immutable (silently
// ignored if sent, per contract).
const patchSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "name không được để trống.")
      .max(NAME_MAX, `name không được dài quá ${NAME_MAX} ký tự.`)
      .optional(),
    color: z
      .union([z.string().regex(HEX_COLOR, "color phải có dạng #RRGGBB."), z.null()])
      .optional(),
  })
  // Strip unknown keys (e.g. a stray `language`) — contract: language is silently ignored on PATCH.
  .passthrough();

// Owner-scoped loader. Same shape as getOwnedEntry — 404 hides existence cross-user.
async function getOwnedTopic(id: string, userId: string) {
  const topic = await prisma.vocabularyTopic.findUnique({ where: { id } });
  if (!topic || topic.userId !== userId) {
    throw new AppError("NOT_FOUND", "Không tìm thấy chủ đề từ vựng.");
  }
  return topic;
}

function conflictMessage(name: string, language: Language): string {
  const langLabel = language === "en" ? "tiếng Anh" : "tiếng Trung";
  return `Bạn đã có chủ đề tên '${name}' trong ${langLabel}.`;
}

// GET /api/vocabulary-topics?language=en|zh -> { items: VocabularyTopic[], total }
// Defaults language to user.language; 403 LANGUAGE_NOT_SELECTED on null+null.
export async function listVocabularyTopics(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const language = await resolveListLanguage(userId, req.query.language);

  const topics = await prisma.vocabularyTopic.findMany({
    where: { userId, language },
  });
  // Order by name ASC, case-insensitive (Postgres default collation is locale-dependent;
  // sort in JS so the response is deterministic regardless of DB collation).
  topics.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const items = topics.map(toVocabularyTopic);
  res.status(200).json({ items, total: items.length });
}

// POST /api/vocabulary-topics -> 201 { item: VocabularyTopic }
// Trims name before storage AND before uniqueness check.
export async function createVocabularyTopic(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const body = parseBody(createSchema, req.body);
  const language = await resolveCreateLanguage(userId, body.language);

  const name = body.name; // already trimmed by zod

  try {
    const created = await prisma.vocabularyTopic.create({
      data: {
        userId,
        name,
        color: body.color ?? null,
        language,
      },
    });
    res.status(201).json({ item: toVocabularyTopic(created) });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError("TOPIC_NAME_CONFLICT", conflictMessage(name, language));
    }
    throw err;
  }
}

// PATCH /api/vocabulary-topics/:id -> 200 { item: VocabularyTopic }
// Owner-only (404 NOT_FOUND otherwise). Patch semantics: only provided fields are updated.
// Rename to the same value is allowed (returns 200; updatedAt refreshed).
export async function updateVocabularyTopic(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const existing = await getOwnedTopic(req.params.id, userId);
  const body = parseBody(patchSchema, req.body);

  // Build a partial update. Absent fields stay untouched.
  const data: { name?: string; color?: string | null } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.color !== undefined) data.color = body.color; // explicit null clears

  try {
    const updated = await prisma.vocabularyTopic.update({
      where: { id: existing.id },
      data,
    });
    res.status(200).json({ item: toVocabularyTopic(updated) });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Conflict only possible on rename; language is immutable so it stays the existing one.
      throw new AppError(
        "TOPIC_NAME_CONFLICT",
        conflictMessage(data.name ?? existing.name, existing.language === "zh" ? "zh" : "en")
      );
    }
    throw err;
  }
}

// DELETE /api/vocabulary-topics/:id -> 200 { id }
// Transactional SET NULL on referencing entries (entries are NEVER deleted), then delete topic.
// The defensive `userId` filter on both statements matches the contract's SQL plan.
export async function deleteVocabularyTopic(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const existing = await getOwnedTopic(req.params.id, userId);

  await prisma.$transaction([
    prisma.vocabularyEntry.updateMany({
      where: { userId, vocabularyTopicId: existing.id },
      data: { vocabularyTopicId: null },
    }),
    prisma.vocabularyTopic.delete({
      where: { id: existing.id },
    }),
  ]);

  res.status(200).json({ id: existing.id });
}
