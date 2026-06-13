// v6 — Language resolution helpers.
// Wire-level Language is "en" | "zh" (lowercase). Default-from-user logic is centralized here so
// every list/dashboard endpoint and every POST that needs a per-user default behaves identically.

import { AppError } from "./errors";
import { prisma } from "./prisma";

export type Language = "en" | "zh";

export function isLanguage(v: unknown): v is Language {
  return v === "en" || v === "zh";
}

// Parse an optional `?language=` query string. Returns the explicit language if valid; throws
// VALIDATION_ERROR on a bad value; returns null when the caller did not pass the param at all.
export function parseLanguageQuery(raw: unknown): Language | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (Array.isArray(raw)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Tham số 'language' chỉ chấp nhận một giá trị."
    );
  }
  if (typeof raw !== "string" || !isLanguage(raw)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Tham số 'language' chỉ chấp nhận 'en' hoặc 'zh'."
    );
  }
  return raw;
}

// Resolve the effective language for a read endpoint that defaults to user.language when the
// query param is absent. Throws 403 LANGUAGE_NOT_SELECTED iff both the query is absent and the
// user has never picked.
export async function resolveListLanguage(
  userId: string,
  rawQuery: unknown
): Promise<Language> {
  const explicit = parseLanguageQuery(rawQuery);
  if (explicit !== null) return explicit;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { language: true },
  });
  if (!u || !isLanguage(u.language)) {
    throw new AppError(
      "LANGUAGE_NOT_SELECTED",
      "Vui lòng chọn ngôn ngữ học trước."
    );
  }
  return u.language;
}

// Resolve a language for a CREATE endpoint where `language` may live in the request body. Same
// semantics: explicit body wins; otherwise inherit from user; otherwise 403.
export async function resolveCreateLanguage(
  userId: string,
  bodyLanguage: unknown
): Promise<Language> {
  if (bodyLanguage !== undefined && bodyLanguage !== null && bodyLanguage !== "") {
    if (!isLanguage(bodyLanguage)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Trường 'language' chỉ chấp nhận 'en' hoặc 'zh'."
      );
    }
    return bodyLanguage;
  }
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { language: true },
  });
  if (!u || !isLanguage(u.language)) {
    throw new AppError(
      "LANGUAGE_NOT_SELECTED",
      "Vui lòng chọn ngôn ngữ học trước."
    );
  }
  return u.language;
}

// v6 amendment (2026-06-13) — three-step slug resolution for detail endpoints.
// 1. explicit language wins (exact (slug, language) match → 404 if absent).
// 2. else prefer (slug, user.language) if user has picked one.
// 3. else fall back to the deterministic "ANY" row: orderBy (createdAt asc, id asc).
// NEVER raises LANGUAGE_NOT_SELECTED — fresh users can still deep-link to seeded content.
//
// The loader returns whatever the caller's `find` callback returns (Topic | Exercise | with
// includes / null). Keeping the load function as a callback lets controllers compose includes
// (flashcards, questions, _count, …) without us second-guessing their needs here.
export async function resolveSlug<T>(
  slug: string,
  opts: {
    explicitLanguage: Language | null;
    userLanguage: Language | null;
    findOne: (where: { slug: string; language?: Language }) => Promise<T | null>;
    findFallback: (slug: string) => Promise<T | null>;
  }
): Promise<T | null> {
  // Step 1: explicit pin.
  if (opts.explicitLanguage) {
    return opts.findOne({ slug, language: opts.explicitLanguage });
  }
  // Step 2: prefer user's language.
  if (opts.userLanguage) {
    const preferred = await opts.findOne({ slug, language: opts.userLanguage });
    if (preferred) return preferred;
  }
  // Step 3: deterministic fallback to ANY.
  return opts.findFallback(slug);
}

// Fetch the caller's stored language without throwing. Returns null when no row or column is null.
// Use this in detail endpoints where LANGUAGE_NOT_SELECTED must never be raised.
export async function getUserLanguage(userId: string): Promise<Language | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { language: true },
  });
  return u && isLanguage(u.language) ? u.language : null;
}
