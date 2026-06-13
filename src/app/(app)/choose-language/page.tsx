"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthContext } from "@/components/auth-context";
import { updateLanguage } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import type { Language } from "@/lib/types";
import { LanguageGate } from "@/components/language-gate";

/**
 * v6 — /choose-language. Rendered inside the (app) shell but BYPASSES the
 * language gate in the layout (it's the page that sets the value). Reachable
 * both as a forced step after register/login when `user.language === null`
 * and from the TopNav switcher when the user already has a language.
 */
export default function ChooseLanguagePage() {
  const router = useRouter();
  const { user, refresh } = useAuthContext();
  const [pending, setPending] = useState<Language | null>(null);

  async function handleSelect(language: Language) {
    if (pending) return;
    setPending(language);
    try {
      await updateLanguage(language);
      await refresh();
      toast.success(
        language === "zh"
          ? "Bắt đầu học Tiếng Trung."
          : "Bắt đầu học Tiếng Anh.",
      );
      router.replace("/dashboard");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Không lưu được lựa chọn. Vui lòng thử lại.";
      toast.error(msg);
      setPending(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">
          Bạn muốn học ngôn ngữ nào?
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] sm:text-base">
          Có thể đổi bất cứ lúc nào qua menu phía trên.
        </p>
      </header>

      <LanguageGate
        current={user.language}
        pending={pending}
        onSelect={handleSelect}
        disabled={pending !== null}
      />
    </div>
  );
}
