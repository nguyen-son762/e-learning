"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getToken } from "@/lib/auth";
import { fetchMe } from "@/hooks/useAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    let active = true;
    fetchMe()
      .then((res) => {
        if (!active) return;
        if (res.user.role !== "ADMIN") {
          router.replace("/dashboard");
        } else {
          setReady(true);
        }
      })
      .catch(() => { if (active) router.replace("/login"); });
    return () => { active = false; };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return <>{children}</>;
}
