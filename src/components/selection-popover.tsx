"use client";

import { useEffect, useRef, useState } from "react";
import { X, BookPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VocabularyForm } from "@/components/vocabulary-form";
import { mineVocabulary } from "@/hooks/useVocabulary";
import type { Language, VocabularyInput } from "@/lib/types";

interface Pos {
  top: number;
  left: number;
}

interface Props {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  passageText: string;
  language: Language;
}

export function SelectionPopover({
  containerRef,
  enabled,
  passageText,
  language,
}: Props) {
  const [word, setWord] = useState<string>("");
  const [sentence, setSentence] = useState<string>("");
  const [pos, setPos] = useState<Pos | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      if (wordCount < 1 || wordCount > 5) {
        setWord("");
        setSentence("");
        setPos(null);
        return;
      }

      const anchorNode = sel.anchorNode;
      const container = containerRef.current;
      if (!container || !anchorNode || !container.contains(anchorNode)) return;

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
    return () => el.removeEventListener("mouseup", handleMouseUp);
  }, [containerRef, enabled, passageText]);

  // Dismiss popover on outside click (but not when dialog is open).
  useEffect(() => {
    if (!pos || dialogOpen) return;
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
  }, [pos, dialogOpen]);

  function dismissPopover() {
    setPos(null);
    setWord("");
    setSentence("");
    window.getSelection()?.removeAllRanges();
  }

  function openDialog() {
    setDialogOpen(true);
  }

  async function handleSave(input: VocabularyInput) {
    await mineVocabulary({ ...input, language });
    toast.success(`Đã lưu "${input.word}" vào từ vựng của bạn`);
    setDialogOpen(false);
    dismissPopover();
  }

  const initialFormState = word
    ? {
      word,
      meaning: "",
      pronunciation: "",
      partOfSpeech: "",
      synonyms: "",
      antonyms: "",
      exampleSentence: sentence !== word ? sentence : "",
      notes: "",
      tags: "",
      cefrLevel: "",
      pinyin: "",
      hskLevel: "",
    }
    : undefined;

  return (
    <>
      {/* Inline popover bubble */}
      {pos && word && !dialogOpen && (
        <div
          ref={popRef}
          role="tooltip"
          style={{
            position: "absolute",
            top: pos.top,
            left: pos.left,
            transform: "translate(-50%, -100%)",
          }}
          className="z-50 flex max-w-xs flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="max-w-[14rem] truncate font-bold">{word}</span>
            <button
              type="button"
              aria-label="Đóng"
              onClick={dismissPopover}
              className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {sentence && sentence !== word && (
            <p className="line-clamp-2 text-xs italic text-[var(--muted-foreground)]">
              "{sentence}"
            </p>
          )}
          <Button size="sm" onClick={openDialog} className="w-full">
            <BookPlus className="h-4 w-4" />
            Lưu vào từ vựng của tôi
          </Button>
        </div>
      )}

      {/* Vocab dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) dismissPopover();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lưu vào từ vựng của tôi</DialogTitle>
          </DialogHeader>
          {initialFormState && (
            <VocabularyForm
              initial={initialFormState}
              language={language}
              submitLabel="Lưu từ vựng"
              showDictionary={language === "en"}
              onSubmit={handleSave}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

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
