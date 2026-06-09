"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getToken, clearToken } from "@/lib/auth";
import { fetchMe } from "@/hooks/useAuth";

/**
 * Landing → redirect.
 * - No token → /login
 * - Token valid (GET /api/auth/me 200) → /dashboard
 * - Token invalid (401) → clear + /login
 */
export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let active = true;
    fetchMe()
      .then(() => {
        if (active) router.replace("/dashboard");
      })
      .catch(() => {
        clearToken();
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
    </div>
  );
}
