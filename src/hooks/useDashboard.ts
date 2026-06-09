"use client";

import { fetchJson } from "@/lib/api";
import { useQuery } from "@/hooks/useQuery";
import type { DashboardResponse } from "@/lib/types";

// GET /api/dashboard → DashboardResponse
// { totals, topicProgress: {items,total}, recentAttempts: {items,total} }
export function useDashboard() {
  return useQuery<DashboardResponse>(
    (signal) => fetchJson<DashboardResponse>("/api/dashboard", { signal }),
    "dashboard",
  );
}
