"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Language } from "@/lib/types";

interface Option {
  language: Language;
  flag: string;
  ariaFlag: string;
  title: string;
  badge: string;
  description: string;
}

const OPTIONS: Option[] = [
  {
    language: "en",
    flag: "🇬🇧",
    ariaFlag: "Quốc kỳ Anh",
    title: "Học Tiếng Anh",
    badge: "CEFR A1 → C2",
    description: "Từ vựng, đọc hiểu, flashcard SRS.",
  },
  {
    language: "zh",
    flag: "🇨🇳",
    ariaFlag: "Quốc kỳ Trung Quốc",
    title: "Học Tiếng Trung",
    badge: "HSK 1 → 3 (MVP)",
    description: "Hán tự, pinyin, flashcard SRS.",
  },
];

/**
 * v6 — Two large cards (English / Chinese). Click → fire `onSelect(language)`
 * which the page wires to `PUT /api/users/me/language` then redirect.
 *
 * `current` highlights the currently-chosen language (re-entry from TopNav);
 * `pending` shows a spinner inside that card. Whole card is the click target;
 * the inner Button is a visual affordance.
 */
export function LanguageGate({
  current,
  pending,
  onSelect,
  disabled = false,
}: {
  current: Language | null;
  pending: Language | null;
  onSelect: (language: Language) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {OPTIONS.map((opt) => (
        <LanguageOptionCard
          key={opt.language}
          option={opt}
          isCurrent={current === opt.language}
          isPending={pending === opt.language}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function LanguageOptionCard({
  option,
  isCurrent,
  isPending,
  disabled,
  onSelect,
}: {
  option: Option;
  isCurrent: boolean;
  isPending: boolean;
  disabled: boolean;
  onSelect: (language: Language) => void;
}) {
  const [focused, setFocused] = useState(false);

  function activate() {
    if (disabled || isPending) return;
    onSelect(option.language);
  }

  return (
    <Card
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Chọn học ${option.title.replace("Học ", "")}`}
      aria-pressed={isCurrent}
      aria-disabled={disabled}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-4 p-6 transition-colors",
        "hover:bg-[var(--secondary)]",
        isCurrent && "border-2 border-[var(--success)]",
        disabled && "cursor-not-allowed opacity-60",
        focused && "ring-2 ring-[var(--ring)] ring-offset-2",
      )}
    >
      <CardHeader className="flex flex-col items-center gap-2 pb-0">
        {isCurrent && <Badge variant="success">Đang học</Badge>}
        <span
          aria-label={option.ariaFlag}
          role="img"
          className="text-7xl leading-none"
        >
          {option.flag}
        </span>
        <CardTitle className="text-2xl">{option.title}</CardTitle>
        <Badge variant="secondary" className="text-xs">
          {option.badge}
        </Badge>
        <CardDescription className="text-center">
          {option.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="w-full pt-0">
        <Button
          type="button"
          className="w-full"
          disabled={disabled || isPending}
          onClick={(e) => {
            e.stopPropagation();
            activate();
          }}
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isCurrent ? "Tiếp tục học" : "Bắt đầu"}
        </Button>
      </CardContent>
    </Card>
  );
}
