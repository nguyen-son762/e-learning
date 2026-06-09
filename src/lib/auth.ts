/**
 * Client-side JWT storage. Token is kept in localStorage per the task spec.
 * All accessors are SSR-safe (guard `typeof window`).
 */
import type { User } from "@/lib/types";

const TOKEN_KEY = "el_token";
const USER_KEY = "el_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Persist token + user after a successful auth response. */
export function persistSession(token: string, user: User): void {
  setToken(token);
  setStoredUser(user);
}
