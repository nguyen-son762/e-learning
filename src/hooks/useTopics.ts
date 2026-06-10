"use client";

import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type {
  ListResponse,
  TopicSummary,
  TopicDetail,
  FlashcardProgressResponse,
  TopicResetResponse,
  Flashcard,
  DeleteResponse,
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
// v3: optional `quality` (0–5) feeds the SM-2 SRS scheduler. Omitted bodies
// keep working (backend defaults to quality=3).
export function markFlashcard(
  id: string,
  known: boolean,
  quality?: number,
): Promise<FlashcardProgressResponse> {
  const body: { known: boolean; quality?: number } = { known };
  if (typeof quality === "number") body.quality = quality;
  return fetchJson<FlashcardProgressResponse>(
    `/api/flashcards/${encodeURIComponent(id)}/progress`,
    { method: "PUT", body },
  );
}

// POST /api/topics/:slug/progress/reset → TopicResetResponse
export function resetTopicProgress(slug: string): Promise<TopicResetResponse> {
  return fetchJson<TopicResetResponse>(
    `/api/topics/${encodeURIComponent(slug)}/progress/reset`,
    { method: "POST", body: {} },
  );
}

// ---- v4 — Feature 7 — user-created topics & flashcards ----

// POST /api/topics → TopicSummary (single object, NOT wrapped)
export function createTopic(body: {
  title: string;
  titleVi: string;
  description?: string;
}): Promise<TopicSummary> {
  return fetchJson<TopicSummary>("/api/topics", { method: "POST", body });
}

// PUT /api/topics/:slug → TopicSummary (single object)
export function updateTopic(
  slug: string,
  body: { title?: string; titleVi?: string; description?: string | null },
): Promise<TopicSummary> {
  return fetchJson<TopicSummary>(
    `/api/topics/${encodeURIComponent(slug)}`,
    { method: "PUT", body },
  );
}

// DELETE /api/topics/:slug → { success: true }
export function deleteTopic(slug: string): Promise<DeleteResponse> {
  return fetchJson<DeleteResponse>(
    `/api/topics/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
}

// POST /api/topics/:slug/flashcards → Flashcard (single object)
export function addFlashcard(
  slug: string,
  body: { front: string; back: string; example?: string },
): Promise<Flashcard> {
  return fetchJson<Flashcard>(
    `/api/topics/${encodeURIComponent(slug)}/flashcards`,
    { method: "POST", body },
  );
}

// PUT /api/flashcards/:id → Flashcard (single object)
export function updateFlashcard(
  id: string,
  body: { front?: string; back?: string; example?: string | null },
): Promise<Flashcard> {
  return fetchJson<Flashcard>(
    `/api/flashcards/${encodeURIComponent(id)}`,
    { method: "PUT", body },
  );
}

// DELETE /api/flashcards/:id → { success: true }
export function deleteFlashcard(id: string): Promise<DeleteResponse> {
  return fetchJson<DeleteResponse>(
    `/api/flashcards/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
