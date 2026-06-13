"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getToken } from "@/lib/auth";
import { fetchMe } from "@/hooks/useAuth";

/**
 * Centered card shell for /login and /register.
 * If a valid token already exists → redirect to /dashboard.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecking(false);
      return;
    }
    let active = true;
    fetchMe()
      .then((res) => {
        if (!active) return;
        // v6 — already authed: respect language gate.
        if (res.user.language === null) router.replace("/choose-language");
        else router.replace("/dashboard");
      })
      .catch(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--muted)] px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-2xl font-bold text-[var(--primary)]">
        <span aria-hidden>📚</span>
        <span>EngLearn</span>
      </div>
      {children}
    </main>
  );
}
