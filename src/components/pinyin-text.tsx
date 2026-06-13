import { cn } from "@/lib/utils";

/**
 * v6 — Wraps a pinyin string ("nǐ hǎo") with the `flashcard-pinyin` typography
 * token and `lang="zh-Latn-pinyin"` (BCP-47) so screen-readers and font hinting
 * pick the right shaper. Diacritics render from Inter's latin-extended subset.
 */
export function PinyinText({
  children,
  className,
  size = "lg",
  as: Tag = "span",
}: {
  children: React.ReactNode;
  className?: string;
  /** "lg" → flashcard-pinyin token (22px). "sm" → caption-style (14px, muted). */
  size?: "lg" | "sm";
  as?: "span" | "div" | "p";
}) {
  return (
    <Tag
      lang="zh-Latn-pinyin"
      className={cn(
        size === "lg"
          ? "text-flashcard-pinyin"
          : "text-sm italic text-[var(--muted-foreground)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
