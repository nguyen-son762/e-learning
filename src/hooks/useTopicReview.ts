"use client";

import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type { TopicReviewResponse } from "@/lib/types";

// GET /api/topics/:slug/review → { items: Flashcard[], total, dueCount }
export function useTopicReview(slug: string) {
  return useQuery<TopicReviewResponse>(
    (signal) =>
      fetchJson<TopicReviewResponse>(
        `/api/topics/${encodeURIComponent(slug)}/review`,
        { signal },
      ),
    `topic-review:${slug}`,
  );
}
