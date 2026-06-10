"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createVocabulary } from "@/hooks/useVocabulary";
import { lookupWord, DictionaryNotFoundError } from "@/lib/dictionary";
import type { VocabularyInput } from "@/lib/types";
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
  /** Optional sentence-level context for "exampleSentence" auto-fill. */
  passageText?: string;
}

/**
 * Floats a "Add to vocabulary" popover near the user's text selection inside
 * `containerRef`. 1–5 word selections only. Dismisses on outside click, ✕,
 * or when the selection collapses. Looks up the word via the client-side
 * dictionary (best-effort) before POSTing to /api/vocabulary.
 */
export function SelectionPopover({ containerRef, enabled, passageText }: Props) {
  const [word, setWord] = useState<string>("");
  const [pos, setPos] = useState<Pos | null>(null);
  const [saving, setSaving] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  // Listen for mouseup inside the container and decide whether to show.
  useEffect(() => {
    if (!enabled) {
      setWord("");
      setPos(null);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    function handleMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setWord("");
        setPos(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setWord("");
        setPos(null);
        return;
      }
      const wordCount = text.split(/\s+/).length;
      if (wordCount < 1 || wordCount > 5) {
        setWord("");
        setPos(null);
        return;
      }

      // Ensure the selection lives inside our container.
      const anchorNode = sel.anchorNode;
      const container = containerRef.current;
      if (!container || !anchorNode || !container.contains(anchorNode)) {
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      setWord(text);
      // Position above the selection; scroll-offset so it stays anchored on scroll.
      setPos({
        top: rect.top + window.scrollY - 8, // sit just above the selection
        left: rect.left + window.scrollX + rect.width / 2,
      });
    }

    el.addEventListener("mouseup", handleMouseUp);
    return () => {
      el.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef, enabled]);

  // Dismiss on outside click.
  useEffect(() => {
    if (!pos) return;
    function handleDocClick(e: MouseEvent) {
      const node = popRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        // Don't dismiss if the user is selecting more text — the next mouseup
        // will recompute. Just check that the click isn't on a fresh selection.
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setPos(null);
          setWord("");
        }
      }
    }
    // Defer to avoid catching the same mouseup that opened us.
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
    window.getSelection()?.removeAllRanges();
  }

  async function addToVocabulary() {
    if (!word || saving) return;
    setSaving(true);

    // Best-effort dictionary lookup; failures fall through to a bare entry.
    // Seed `meaning` with `word` so the POST satisfies the contract's
    // non-empty `meaning` requirement even when the dictionary returns nothing.
    const input: VocabularyInput = { word, meaning: word };
    try {
      const fill = await lookupWord(word);
      if (fill.meaning) input.meaning = fill.meaning;
      if (fill.pronunciation) input.pronunciation = fill.pronunciation;
      if (fill.partOfSpeech) input.partOfSpeech = fill.partOfSpeech;
      if (fill.exampleSentence) {
        input.exampleSentence = fill.exampleSentence;
      } else if (passageText) {
        // Fallback: pull the sentence containing the word from the passage.
        const sentence = findSentence(passageText, word);
        if (sentence) input.exampleSentence = sentence;
      }
    } catch (err) {
      // Not-found / network / parse — proceed without dictionary fill.
      if (!(err instanceof DictionaryNotFoundError)) {
        // silent fallback — we still try to save the word
      }
    }

    try {
      await createVocabulary(input);
      toast.success(`Đã thêm "${word}" vào từ vựng của bạn`);
      dismiss();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Không thêm được từ vào từ vựng.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!pos || !word) return null;

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Thêm vào từ vựng"
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        transform: "translate(-50%, -100%)",
      }}
      className="z-50 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-lg"
    >
      <span className="max-w-[14rem] truncate text-sm font-bold">{word}</span>
      <Button size="sm" onClick={addToVocabulary} disabled={saving}>
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Thêm vào từ vựng
      </Button>
      <button
        type="button"
        aria-label="Đóng"
        onClick={dismiss}
        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function findSentence(text: string, word: string): string | null {
  // Coarse sentence split on . ! ? — good enough for highlighting context.
  const sentences = text.split(/(?<=[.!?])\s+/);
  const needle = word.toLowerCase();
  for (const s of sentences) {
    if (s.toLowerCase().includes(needle)) return s.trim();
  }
  return null;
}
