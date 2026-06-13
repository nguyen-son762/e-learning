"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/types";

/**
 * v6 — Read-only context published by `(app)/layout.tsx` so any descendant
 * (TopNav switcher, /choose-language, future screens) can read the live `User`
 * (including `user.language`) and ask the shell to re-fetch /api/auth/me when
 * the user's preferences change. Throws if used outside the shell.
 */
export interface AuthContextValue {
  user: User;
  /** Re-fetches GET /api/auth/me and updates the cached user. */
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuthContext must be used inside the (app) shell layout.",
    );
  }
  return ctx;
}
