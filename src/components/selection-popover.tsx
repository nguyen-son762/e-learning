"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mineVocabulary } from "@/hooks/useVocabulary";
import type { Language } from "@/lib/types";
import { ApiError } from "@/lib/api";

interface Pos {
  top: number;
  left: number;
}

interface Props {
  /** Element whose selections we listen to. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** When false (e.g. after submit), the popover is suppressed. */
  enabled: boolean;
  /** Full passage text — used to extract the surrounding sentence for context. */
  passageText: string;
  /**
   * v7 — language of the reading exercise. Required because POST
   * /api/vocabulary/mine does NOT inherit from user.language — the screen's
   * language is the source of truth.
   */
  language: Language;
}

/**
 * v7 — Sentence Mining popover. On a 1–5 word selection inside
 * `containerRef`, shows the selected word + surrounding sentence and lets the
 * user save it via POST /api/vocabulary/mine.
 */
export function SelectionPopover({
  containerRef,
  enabled,
  passageText,
  language,
}: Props) {
  const [word, setWord] = useState<string>("");
  const [sentence, setSentence] = useState<string>("");
  const [pos, setPos] = useState<Pos | null>(null);
  const [saving, setSaving] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      setWord("");
      setSentence("");
      setPos(null);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    function handleMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setWord("");
        setSentence("");
        setPos(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setWord("");
        setSentence("");
        setPos(null);
        return;
      }
      // Word-count cap: 1–5 words (CJK falls through this — 0 spaces → 1 "word").
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      if (wordCount < 1 || wordCount > 5) {
        setWord("");
        setSentence("");
        setPos(null);
        return;
      }

      const anchorNode = sel.anchorNode;
      const container = containerRef.current;
      if (!container || !anchorNode || !container.contains(anchorNode)) {
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const ctx = findSentence(passageText, text) ?? text;
      setWord(text);
      setSentence(ctx);
      setPos({
        top: rect.top + window.scrollY - 8,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    }

    el.addEventListener("mouseup", handleMouseUp);
    return () => {
      el.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef, enabled, passageText]);

  // Dismiss on outside click.
  useEffect(() => {
    if (!pos) return;
    function handleDocClick(e: MouseEvent) {
      const node = popRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setPos(null);
          setWord("");
          setSentence("");
        }
      }
    }
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handleDocClick);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handleDocClick);
    };
  }, [pos]);

  function dismiss() {
    setPos(null);
    setWord("");
    setSentence("");
    window.getSelection()?.removeAllRanges();
  }

  async function saveMined() {
    if (!word || saving) return;
    setSaving(true);
    try {
      await mineVocabulary({ word, exampleSentence: sentence, language });
      toast.success(`Đã lưu "${word}" vào Mined vocab`);
      dismiss();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Từ này đã có trong vocab của bạn");
        dismiss();
      } else {
        const msg =
          err instanceof ApiError ? err.message : "Không lưu được flashcard.";
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!pos || !word) return null;

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Lưu flashcard"
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        transform: "translate(-50%, -100%)",
      }}
      className="z-50 flex max-w-sm flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="max-w-[16rem] truncate text-lg font-bold">{word}</span>
        <button
          type="button"
          aria-label="Đóng"
          onClick={dismiss}
          className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {sentence && sentence !== word && (
        <p className="line-clamp-2 text-sm italic text-[var(--muted-foreground)]">
          “{sentence}”
        </p>
      )}
      <div className="flex justify-end">
        <Button size="sm" onClick={saveMined} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Lưu flashcard
        </Button>
      </div>
    </div>
  );
}

/** Find the sentence in `text` containing `needle` (split on . ? ! 。！？). */
function findSentence(text: string, needle: string): string | null {
  const sentences = text.split(/(?<=[.!?。！？])\s*/);
  const n = needle.toLowerCase();
  for (const s of sentences) {
    if (s.toLowerCase().includes(n)) {
      const trimmed = s.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}
