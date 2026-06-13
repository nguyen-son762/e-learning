"use client";

import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type { DashboardResponse, Language } from "@/lib/types";

// GET /api/dashboard → DashboardResponse
// { totals, topicProgress: {items,total}, recentAttempts: {items,total} }
// v6 — optional language filter; omitted → server defaults to user's language.
export function useDashboard(language?: Language) {
  const q = language ? `?language=${language}` : "";
  return useQuery<DashboardResponse>(
    (signal) => fetchJson<DashboardResponse>(`/api/dashboard${q}`, { signal }),
    `dashboard${q}`,
  );
}
