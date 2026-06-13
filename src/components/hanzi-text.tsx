import { cn } from "@/lib/utils";

/**
 * v6 — Wraps Simplified Hán tự content with `lang="zh-CN"` and the CJK font
 * fallback chain (Noto Sans SC). Defaults to the `text-flashcard-hanzi` token
 * (64/72px on md+, 56px on mobile); pass a different class to override (e.g.
 * `text-2xl font-cjk` for the vocabulary list word column).
 */
export function HanziText({
  children,
  className,
  large = true,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  className?: string;
  /** false → just apply font-cjk; true → also apply the flashcard-hanzi type size. */
  large?: boolean;
  as?: "span" | "div" | "p";
}) {
  return (
    <Tag
      lang="zh-CN"
      className={cn(large ? "text-flashcard-hanzi" : "font-cjk", className)}
    >
      {children}
    </Tag>
  );
}
