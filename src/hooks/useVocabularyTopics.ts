"use client";

/**
 * v8 — Personal Vocabulary Topics hooks.
 *
 * The list endpoint is per-language; pass the resolved language explicitly so
 * topics shown in a form/list match the entity language being edited (which
 * may differ from `user.language` when editing a vocab entry).
 *
 * Mutation responses are wrapped in `{ item }` (POST/PATCH) or `{ id }` (DELETE),
 * matching api-contract.md v8 exactly. Hooks unwrap so callers receive the
 * underlying `VocabularyTopic`.
 */
import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type {
  ListResponse,
  Language,
  VocabularyTopic,
  VocabularyTopicCreateInput,
  VocabularyTopicPatchInput,
  VocabularyTopicItemResponse,
  VocabularyTopicDeleteResponse,
} from "@/lib/types";

/**
 * GET /api/vocabulary-topics?language=<L> → { items: VocabularyTopic[], total }.
 * Pass `language` to scope the list (defaults server-side to user.language; we
 * pass explicitly so the per-language cache key invalidates cleanly on switch).
 */
export function useVocabularyTopics(language: Language | undefined) {
  const query = language ? `?language=${language}` : "";
  const key = `vocabulary-topics:${language ?? ""}`;
  return useQuery<ListResponse<VocabularyTopic>>(
    (signal) =>
      fetchJson<ListResponse<VocabularyTopic>>(
        `/api/vocabulary-topics${query}`,
        { signal },
      ),
    key,
  );
}

// POST /api/vocabulary-topics → { item: VocabularyTopic } (201). Unwrap on return.
export async function createVocabularyTopic(
  input: VocabularyTopicCreateInput,
): Promise<VocabularyTopic> {
  const res = await fetchJson<VocabularyTopicItemResponse>(
    "/api/vocabulary-topics",
    { method: "POST", body: input },
  );
  return res.item;
}

// PATCH /api/vocabulary-topics/:id → { item: VocabularyTopic }. Unwrap on return.
export async function updateVocabularyTopic(
  id: string,
  input: VocabularyTopicPatchInput,
): Promise<VocabularyTopic> {
  const res = await fetchJson<VocabularyTopicItemResponse>(
    `/api/vocabulary-topics/${encodeURIComponent(id)}`,
    { method: "PATCH", body: input },
  );
  return res.item;
}

// DELETE /api/vocabulary-topics/:id → { id }.
export function deleteVocabularyTopic(
  id: string,
): Promise<VocabularyTopicDeleteResponse> {
  return fetchJson<VocabularyTopicDeleteResponse>(
    `/api/vocabulary-topics/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
