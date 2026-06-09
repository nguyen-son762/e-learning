"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getToken, clearToken } from "@/lib/auth";
import { fetchMe } from "@/hooks/useAuth";
import type { User } from "@/lib/types";
import { TopNav } from "@/components/top-nav";

/**
 * Authenticated shell. Guards: no valid token → redirect /login.
 * Loads GET /api/auth/me once and renders the top nav.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let active = true;
    fetchMe()
      .then((res) => {
        if (!active) return;
        setUser(res.user);
        setStatus("ready");
      })
      .catch(() => {
        clearToken();
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (status === "loading" || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6">
        {children}
      </main>
    </div>
  );
}
