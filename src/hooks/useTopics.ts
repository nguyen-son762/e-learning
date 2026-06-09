"use client";

import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type {
  ListResponse,
  TopicSummary,
  TopicDetail,
  FlashcardProgressResponse,
  TopicResetResponse,
} from "@/lib/types";

// GET /api/topics → LIST WRAPPER { items: TopicSummary[], total }
export function useTopics() {
  return useQuery<ListResponse<TopicSummary>>(
    (signal) =>
      fetchJson<ListResponse<TopicSummary>>("/api/topics", { signal }),
    "topics",
  );
}

// GET /api/topics/:slug → TopicDetail (single object, NOT wrapped)
export function useTopicDetail(slug: string) {
  return useQuery<TopicDetail>(
    (signal) =>
      fetchJson<TopicDetail>(`/api/topics/${encodeURIComponent(slug)}`, {
        signal,
      }),
    `topic:${slug}`,
  );
}

// PUT /api/flashcards/:id/progress → FlashcardProgressResponse
export function markFlashcard(
  id: string,
  known: boolean,
): Promise<FlashcardProgressResponse> {
  return fetchJson<FlashcardProgressResponse>(
    `/api/flashcards/${encodeURIComponent(id)}/progress`,
    { method: "PUT", body: { known } },
  );
}

// POST /api/topics/:slug/progress/reset → TopicResetResponse
export function resetTopicProgress(slug: string): Promise<TopicResetResponse> {
  return fetchJson<TopicResetResponse>(
    `/api/topics/${encodeURIComponent(slug)}/progress/reset`,
    { method: "POST", body: {} },
  );
}
