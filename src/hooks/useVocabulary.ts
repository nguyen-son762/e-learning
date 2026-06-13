"use client";

import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type {
  ListResponse,
  VocabularyEntry,
  VocabularyInput,
  VocabularyListParams,
  VocabularyFavoriteResponse,
  VocabularyProgressResponse,
  DeleteResponse,
} from "@/lib/types";

/** Build a stable query string from optional list params (empty params dropped). */
function buildVocabularyQuery(params: VocabularyListParams = {}): string {
  const q = new URLSearchParams();
  if (params.search && params.search.trim()) q.set("search", params.search.trim());
  if (params.tag) q.set("tag", params.tag);
  if (params.partOfSpeech) q.set("partOfSpeech", params.partOfSpeech);
  if (params.favorite) q.set("favorite", params.favorite);
  if (params.sort) q.set("sort", params.sort);
  if (params.language) q.set("language", params.language); // v6
  const s = q.toString();
  return s ? `?${s}` : "";
}

// GET /api/vocabulary → LIST WRAPPER { items: VocabularyEntry[], total }
export function useVocabulary(params: VocabularyListParams = {}) {
  const query = buildVocabularyQuery(params);
  return useQuery<ListResponse<VocabularyEntry>>(
    (signal) =>
      fetchJson<ListResponse<VocabularyEntry>>(`/api/vocabulary${query}`, {
        signal,
      }),
    `vocabulary${query}`,
  );
}

// GET /api/vocabulary/tags → LIST WRAPPER of strings { items: string[], total }
// v6 — optional language filter; omitted → server defaults to user's language.
export function useVocabularyTags(language?: string) {
  const q = language ? `?language=${language}` : "";
  return useQuery<ListResponse<string>>(
    (signal) =>
      fetchJson<ListResponse<string>>(`/api/vocabulary/tags${q}`, { signal }),
    `vocabulary:tags${q}`,
  );
}

// GET /api/vocabulary/:id → VocabularyEntry (single object, NOT wrapped)
export function useVocabularyEntry(id: string) {
  return useQuery<VocabularyEntry>(
    (signal) =>
      fetchJson<VocabularyEntry>(`/api/vocabulary/${encodeURIComponent(id)}`, {
        signal,
      }),
    `vocabulary:${id}`,
  );
}

// POST /api/vocabulary → created VocabularyEntry (single object)
export function createVocabulary(
  input: VocabularyInput,
): Promise<VocabularyEntry> {
  return fetchJson<VocabularyEntry>("/api/vocabulary", {
    method: "POST",
    body: input,
  });
}

// PUT /api/vocabulary/:id → updated VocabularyEntry (single object)
export function updateVocabulary(
  id: string,
  input: VocabularyInput,
): Promise<VocabularyEntry> {
  return fetchJson<VocabularyEntry>(`/api/vocabulary/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: input,
  });
}

// DELETE /api/vocabulary/:id → { success: true }
export function deleteVocabulary(id: string): Promise<DeleteResponse> {
  return fetchJson<DeleteResponse>(`/api/vocabulary/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// PUT /api/vocabulary/:id/favorite → { id, isFavorite }
export function setVocabularyFavorite(
  id: string,
  isFavorite: boolean,
): Promise<VocabularyFavoriteResponse> {
  return fetchJson<VocabularyFavoriteResponse>(
    `/api/vocabulary/${encodeURIComponent(id)}/favorite`,
    { method: "PUT", body: { isFavorite } },
  );
}

// PUT /api/vocabulary/:id/progress → { id, known }
export function setVocabularyProgress(
  id: string,
  known: boolean,
): Promise<VocabularyProgressResponse> {
  return fetchJson<VocabularyProgressResponse>(
    `/api/vocabulary/${encodeURIComponent(id)}/progress`,
    { method: "PUT", body: { known } },
  );
}
