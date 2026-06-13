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
  Language,
} from "@/lib/types";

/** v6 — build "?language=en|zh" (omit when undefined → server uses user default). */
function langQuery(language?: Language): string {
  return language ? `?language=${language}` : "";
}

// GET /api/topics → LIST WRAPPER { items: TopicSummary[], total }
// v6 — optional language filter; omitted → server defaults to user's language.
export function useTopics(language?: Language) {
  const q = langQuery(language);
  return useQuery<ListResponse<TopicSummary>>(
    (signal) =>
      fetchJson<ListResponse<TopicSummary>>(`/api/topics${q}`, { signal }),
    `topics${q}`,
  );
}

// GET /api/topics/:slug → TopicDetail (single object, NOT wrapped)
// v6 amendment 2026-06-13 — slug is unique per (slug, language). The cache
// key MUST include `language` to avoid stale renders when the user switches
// language while a detail page is mounted. The optional `language` arg also
// pins the lookup server-side (passes `?language=`); omitted ⇒ server falls
// back to user.language → ANY (deterministic).
export function useTopicDetail(slug: string, language?: Language) {
  const q = language ? `?language=${language}` : "";
  return useQuery<TopicDetail>(
    (signal) =>
      fetchJson<TopicDetail>(
        `/api/topics/${encodeURIComponent(slug)}${q}`,
        { signal },
      ),
    `topic:${slug}:${language ?? ""}`,
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
// v6 — optional `language` in body; omitted → server inherits from user.language.
export function createTopic(body: {
  title: string;
  titleVi: string;
  description?: string;
  language?: Language;
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
