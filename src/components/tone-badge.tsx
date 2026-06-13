import { cn } from "@/lib/utils";

export type Tone = 1 | 2 | 3 | 4 | 5;

const COLOR: Record<Tone, string> = {
  1: "var(--tone-1)",
  2: "var(--tone-2)",
  3: "var(--tone-3)",
  4: "var(--tone-4)",
  5: "var(--tone-5)",
};

const LABEL: Record<Tone, string> = {
  1: "Thanh ngang (1)",
  2: "Thanh sắc (2)",
  3: "Thanh hỏi (3)",
  4: "Thanh huyền (4)",
  5: "Thanh nhẹ (5)",
};

/**
 * v6 — Tiny circular badge showing the tone numeral 1–5 colored by `--tone-*`.
 * Optional decoration next to pinyin syllables; color is never the sole tone
 * signal (pinyin always renders the diacritic mark too).
 */
export function ToneBadge({
  tone,
  className,
}: {
  tone: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white",
        className,
      )}
      style={{ backgroundColor: COLOR[tone] }}
      aria-label={LABEL[tone]}
    >
      {tone}
    </span>
  );
}
