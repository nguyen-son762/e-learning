"use client";

import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type {
  ListResponse,
  ReadingExerciseSummary,
  ReadingExerciseDetail,
  ReadingAttempt,
  ReadingAttemptResult,
} from "@/lib/types";

// GET /api/reading-exercises → LIST WRAPPER { items: ReadingExerciseSummary[], total }
export function useReadingExercises() {
  return useQuery<ListResponse<ReadingExerciseSummary>>(
    (signal) =>
      fetchJson<ListResponse<ReadingExerciseSummary>>(
        "/api/reading-exercises",
        { signal },
      ),
    "reading-exercises",
  );
}

// GET /api/reading-exercises/:slug → ReadingExerciseDetail (no correctIndex)
export function useReadingExercise(slug: string) {
  return useQuery<ReadingExerciseDetail>(
    (signal) =>
      fetchJson<ReadingExerciseDetail>(
        `/api/reading-exercises/${encodeURIComponent(slug)}`,
        { signal },
      ),
    `reading-exercise:${slug}`,
  );
}

// GET /api/reading-exercises/:slug/attempts → LIST WRAPPER { items: ReadingAttempt[], total }
export function useReadingAttempts(slug: string) {
  return useQuery<ListResponse<ReadingAttempt>>(
    (signal) =>
      fetchJson<ListResponse<ReadingAttempt>>(
        `/api/reading-exercises/${encodeURIComponent(slug)}/attempts`,
        { signal },
      ),
    `reading-attempts:${slug}`,
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
