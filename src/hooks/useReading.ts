"use client";

import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type {
  Language,
  ListResponse,
  ReadingExerciseSummary,
  ReadingExerciseDetail,
  ReadingAttempt,
  ReadingAttemptResult,
} from "@/lib/types";

// GET /api/reading-exercises → LIST WRAPPER { items: ReadingExerciseSummary[], total }
// v6 — optional language filter; omitted → server defaults to user's language.
export function useReadingExercises(language?: Language) {
  const q = language ? `?language=${language}` : "";
  return useQuery<ListResponse<ReadingExerciseSummary>>(
    (signal) =>
      fetchJson<ListResponse<ReadingExerciseSummary>>(
        `/api/reading-exercises${q}`,
        { signal },
      ),
    `reading-exercises${q}`,
  );
}

// GET /api/reading-exercises/:slug → ReadingExerciseDetail (no correctIndex)
// v6 amendment 2026-06-13 — slug is unique per (slug, language). Cache key
// includes `language`; optional arg pins server-side lookup via `?language=`.
export function useReadingExercise(slug: string, language?: Language) {
  const q = language ? `?language=${language}` : "";
  return useQuery<ReadingExerciseDetail>(
    (signal) =>
      fetchJson<ReadingExerciseDetail>(
        `/api/reading-exercises/${encodeURIComponent(slug)}${q}`,
        { signal },
      ),
    `reading-exercise:${slug}:${language ?? ""}`,
  );
}

// GET /api/reading-exercises/:slug/attempts → LIST WRAPPER { items: ReadingAttempt[], total }
// v6 amendment — slug resolution applies to attempts too; cache key includes language.
export function useReadingAttempts(slug: string, language?: Language) {
  const q = language ? `?language=${language}` : "";
  return useQuery<ListResponse<ReadingAttempt>>(
    (signal) =>
      fetchJson<ListResponse<ReadingAttempt>>(
        `/api/reading-exercises/${encodeURIComponent(slug)}/attempts${q}`,
        { signal },
      ),
    `reading-attempts:${slug}:${language ?? ""}`,
  );
}

// POST /api/reading-exercises/:slug/attempts → ReadingAttemptResult (with grading)
export function submitReadingAttempt(
  slug: string,
  answers: number[],
): Promise<ReadingAttemptResult> {
  return fetchJson<ReadingAttemptResult>(
    `/api/reading-exercises/${encodeURIComponent(slug)}/attempts`,
    { method: "POST", body: { answers } },
  );
}
