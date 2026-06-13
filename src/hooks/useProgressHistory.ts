"use client";

import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type { Language, ListResponse, ProgressHistoryItem } from "@/lib/types";

// GET /api/dashboard/progress-history?days=7|30[&language=en|zh] → { items, total }.
// v6 — optional language filter; omitted → server defaults to user's language.
export function useProgressHistory(days: 7 | 30, language?: Language) {
  const langQ = language ? `&language=${language}` : "";
  return useQuery<ListResponse<ProgressHistoryItem>>(
    (signal) =>
      fetchJson<ListResponse<ProgressHistoryItem>>(
        `/api/dashboard/progress-history?days=${days}${langQ}`,
        { signal },
      ),
    `dashboard:progress-history:${days}${langQ}`,
  );
}
