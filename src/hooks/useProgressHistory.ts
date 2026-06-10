"use client";

import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type { ListResponse, ProgressHistoryItem } from "@/lib/types";

// GET /api/dashboard/progress-history?days=7|30 → { items, total } (zero-filled).
export function useProgressHistory(days: 7 | 30) {
  return useQuery<ListResponse<ProgressHistoryItem>>(
    (signal) =>
      fetchJson<ListResponse<ProgressHistoryItem>>(
        `/api/dashboard/progress-history?days=${days}`,
        { signal },
      ),
    `dashboard:progress-history:${days}`,
  );
}
