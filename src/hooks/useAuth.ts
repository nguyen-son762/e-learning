"use client";

import { fetchJson } from "@/lib/api";
import { persistSession, setStoredUser } from "@/lib/auth";
import type {
  AuthResponse,
  Language,
  LanguagePreferenceResponse,
  MeResponse,
} from "@/lib/types";

// POST /api/auth/register → AuthResponse { token, user }
export async function register(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthResponse> {
  const res = await fetchJson<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: input,
    auth: false,
  });
  persistSession(res.token, res.user);
  return res;
}

// POST /api/auth/login → AuthResponse { token, user }
export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetchJson<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: input,
    auth: false,
  });
  persistSession(res.token, res.user);
  return res;
}

// GET /api/auth/me → MeResponse { user }
export function fetchMe(signal?: AbortSignal): Promise<MeResponse> {
  return fetchJson<MeResponse>("/api/auth/me", { signal });
}

// v6 — PUT /api/users/me/language → { user: User }. Persists new language; also
// updates the stored User so TopNav + redirects pick up the change immediately.
export async function updateLanguage(
  language: Language,
): Promise<LanguagePreferenceResponse> {
  const res = await fetchJson<LanguagePreferenceResponse>(
    "/api/users/me/language",
    { method: "PUT", body: { language } },
  );
  setStoredUser(res.user);
  return res;
}
