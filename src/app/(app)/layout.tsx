"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getToken, clearToken, setStoredUser } from "@/lib/auth";
import { fetchMe } from "@/hooks/useAuth";
import type { User } from "@/lib/types";
import { TopNav } from "@/components/top-nav";
import { AuthContext } from "@/components/auth-context";

const CHOOSE_LANGUAGE_PATH = "/choose-language";

/**
 * Authenticated shell.
 * Guards:
 *   - No valid token → redirect /login.
 *   - v6: user.language === null AND pathname !== /choose-language → redirect /choose-language.
 *   - 401 from /api/auth/me → clear token + /login.
 *
 * Publishes `AuthContext` (current user + refresh) so descendants can read
 * `user.language` and re-fetch after switching languages.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const loadUser = useCallback(async () => {
    const res = await fetchMe();
    setStoredUser(res.user);
    setUser(res.user);
    return res.user;
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let active = true;
    loadUser()
      .then((u) => {
        if (!active) return;
        setStatus("ready");
        if (u.language === null && pathname !== CHOOSE_LANGUAGE_PATH) {
          router.replace(CHOOSE_LANGUAGE_PATH);
        }
      })
      .catch(() => {
        clearToken();
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
    // pathname intentionally excluded — initial load runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadUser]);

  // v6 — when user.language flips to null (e.g. backend invalidates) or the
  // user navigates back, enforce the gate on each pathname change.
  useEffect(() => {
    if (status !== "ready" || !user) return;
    if (user.language === null && pathname !== CHOOSE_LANGUAGE_PATH) {
      router.replace(CHOOSE_LANGUAGE_PATH);
    }
  }, [status, user, pathname, router]);

  // v6 — defensive: any data hook that hits 403 LANGUAGE_NOT_SELECTED → gate.
  useEffect(() => {
    function onSignal() {
      if (pathname !== CHOOSE_LANGUAGE_PATH) {
        router.replace(CHOOSE_LANGUAGE_PATH);
      }
    }
    window.addEventListener("el:language-not-selected", onSignal);
    return () =>
      window.removeEventListener("el:language-not-selected", onSignal);
  }, [pathname, router]);

  const refresh = useCallback(async () => {
    try {
      await loadUser();
    } catch {
      clearToken();
      router.replace("/login");
    }
  }, [loadUser, router]);

  const ctxValue = useMemo(
    () => (user ? { user, refresh } : null),
    [user, refresh],
  );

  if (status === "loading" || !user || !ctxValue) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  // While the redirect-to-/choose-language is in flight, suppress content to
  // avoid flashing a gated screen.
  if (user.language === null && pathname !== CHOOSE_LANGUAGE_PATH) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={ctxValue}>
      <div className="flex min-h-screen flex-col">
        <TopNav user={user} onLanguageChanged={refresh} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6">
          {children}
        </main>
      </div>
    </AuthContext.Provider>
  );
}
