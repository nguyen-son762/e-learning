"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateLanguage } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import type { Language } from "@/lib/types";

const META: Record<
  Language,
  { flag: string; label: string; short: string; ariaFlag: string }
> = {
  en: { flag: "🇬🇧", label: "Tiếng Anh", short: "EN", ariaFlag: "Quốc kỳ Anh" },
  zh: {
    flag: "🇨🇳",
    label: "Tiếng Trung",
    short: "中",
    ariaFlag: "Quốc kỳ Trung Quốc",
  },
};

const OTHER: Record<Language, Language> = { en: "zh", zh: "en" };

/**
 * v6 — TopNav language switcher (DropdownMenu).
 * Shows the current learning language with a flag + label; menu offers a
 * one-click swap to the other language and a link to /choose-language for the
 * visual two-card picker. On swap, fires PUT /api/users/me/language, then asks
 * the parent to refetch via `onChanged` (which the (app) shell wires to a
 * refresh of /api/auth/me and a router.refresh() so all language-scoped
 * queries re-fetch).
 *
 * Hidden on `/choose-language` (the page itself is the chooser).
 */
export function LanguageSwitcher({
  current,
  onChanged,
}: {
  current: Language;
  onChanged: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  if (pathname === "/choose-language") return null;

  const meta = META[current];
  const other = OTHER[current];
  const otherMeta = META[other];

  async function switchTo(next: Language) {
    if (busy) return;
    setBusy(true);
    try {
      await updateLanguage(next);
      onChanged();
      // Detail routes may not exist in the new language → bounce to dashboard.
      const isDetail =
        /^\/(topics|reading)\/[^/]+/.test(pathname) ||
        /^\/vocabulary\/[^/]+/.test(pathname);
      if (isDetail) router.push("/dashboard");
      else router.refresh();
      toast.success(`Đã chuyển sang ${META[next].label}.`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Không đổi được ngôn ngữ. Vui lòng thử lại.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          aria-label={`Đang học ${meta.label}. Mở menu đổi ngôn ngữ`}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span aria-hidden className="text-base leading-none">
              {meta.flag}
            </span>
          )}
          <span className="hidden text-sm font-medium sm:inline">
            {meta.label}
          </span>
          <span className="text-sm font-medium sm:hidden">{meta.short}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-xs font-normal text-[var(--muted-foreground)]">
            Đang học
          </span>
          <span className="flex items-center gap-2">
            <span aria-label={meta.ariaFlag} role="img">
              {meta.flag}
            </span>
            {meta.label}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => switchTo(other)}
          disabled={busy}
          className="gap-2"
        >
          <span aria-label={otherMeta.ariaFlag} role="img">
            {otherMeta.flag}
          </span>
          Chuyển sang {otherMeta.label}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/choose-language">Đổi ngôn ngữ học…</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
