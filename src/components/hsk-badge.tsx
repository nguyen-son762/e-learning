import { cn } from "@/lib/utils";
import type { HskLevel } from "@/lib/types";

const PALETTE: Record<HskLevel, { bg: string; fg: string }> = {
  1: { bg: "var(--hsk-1-bg)", fg: "var(--hsk-1-fg)" },
  2: { bg: "var(--hsk-2-bg)", fg: "var(--hsk-2-fg)" },
  3: { bg: "var(--hsk-3-bg)", fg: "var(--hsk-3-fg)" },
  4: { bg: "var(--hsk-4-bg)", fg: "var(--hsk-4-fg)" },
  5: { bg: "var(--hsk-5-bg)", fg: "var(--hsk-5-fg)" },
  6: { bg: "var(--hsk-6-bg)", fg: "var(--hsk-6-fg)" },
};

/**
 * v6 — HSK level badge (1–6). Same shape as the shadcn `Badge` primitive,
 * styled with per-level palette tokens (`--hsk-*-bg/fg`).
 */
export function HskBadge({
  level,
  className,
}: {
  level: HskLevel;
  className?: string;
}) {
  const { bg, fg } = PALETTE[level];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md px-2 text-xs font-medium",
        className,
      )}
      style={{ backgroundColor: bg, color: fg }}
      aria-label={`Cấp độ HSK ${level}`}
    >
      HSK {level}
    </span>
  );
}
