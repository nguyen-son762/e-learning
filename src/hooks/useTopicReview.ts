"use client";

import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type { Language, TopicReviewResponse } from "@/lib/types";

// GET /api/topics/:slug/review → { items: Flashcard[], total, dueCount }
// v6 amendment 2026-06-13 — RECLASSIFIED as list-style: accepts optional
// `?language=`; defaults to user.language; `403 LANGUAGE_NOT_SELECTED` if user
// has no language AND no param. Slug resolves against the chosen language.
// Cache key includes language to avoid stale renders across switches.
export function useTopicReview(slug: string, language?: Language) {
  const q = language ? `?language=${language}` : "";
  return useQuery<TopicReviewResponse>(
    (signal) =>
      fetchJson<TopicReviewResponse>(
        `/api/topics/${encodeURIComponent(slug)}/review${q}`,
        { signal },
      ),
    `topic-review:${slug}:${language ?? ""}`,
  );
}
