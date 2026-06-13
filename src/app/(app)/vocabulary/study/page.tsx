"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Volume2,
  PartyPopper,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVocabulary, setVocabularyProgress } from "@/hooks/useVocabulary";
import { useDashboard } from "@/hooks/useDashboard";
import type { VocabularyEntry } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { speak, isTtsSupported } from "@/lib/tts";
import { HanziText } from "@/components/hanzi-text";
import { PinyinText } from "@/components/pinyin-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/states";

export default function VocabularyStudyPage() {
  // Deck = full vocabulary set (sorted oldest→newest for stable order).
  const { data, loading, error, refetch } = useVocabulary({ sort: "oldest" });
  // v7 — surface "n cards due today" CTA (language-scoped via dashboard).
  const { data: dash } = useDashboard();
  const ttsOk = isTtsSupported();

  const [cards, setCards] = useState<VocabularyEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setCards(data.items);
      setIndex(0);
      setFlipped(false);
    }
  }, [data]);

  const knownCount = cards.filter((c) => c.known).length;
  const total = cards.length;
  const percent = total === 0 ? 0 : Math.round((knownCount / total) * 100);
  const current = cards[index];
  const allKnown = total > 0 && knownCount === total;

  const goPrev = useCallback(() => {
    setFlipped(false);
    setIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setFlipped(false);
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  // Keyboard: Space=flip, ArrowLeft/Right=nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.code === "ArrowLeft") {
        goPrev();
      } else if (e.code === "ArrowRight") {
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  async function mark(known: boolean) {
    if (!current) return;
    const id = current.id;
    const prev = current.known;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, known } : c)));
    // Auto-advance to the next card (don't wait for the API).
    if (index < total - 1) {
      goNext();
    } else {
      setFlipped(false);
    }
    setSavingId(id);
    try {
      await setVocabularyProgress(id, known);
    } catch (err) {
      setCards((cs) =>
        cs.map((c) => (c.id === id ? { ...c, known: prev } : c)),
      );
      const msg =
        err instanceof ApiError ? err.message : "Không lưu được tiến độ.";
      toast.error(msg);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />;
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Học từ vựng của tôi</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--muted-foreground)]">
            {knownCount}/{total} đã thuộc · {percent}%
          </span>
          {/* v7 — language-scoped due count from /api/dashboard */}
          {dash && (
            <Badge variant="secondary">
              {dash.dueToday} từ cần ôn hôm nay
            </Badge>
          )}
        </div>
      </div>

      {total === 0 ? (
        <EmptyState
          title="Chưa có từ để học"
          description="Hãy thêm vài từ vào danh sách trước khi bắt đầu học."
          action={
            <Button asChild className="w-fit">
              <Link href="/vocabulary/new">
                <Plus className="h-4 w-4" />
                Thêm từ
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <Progress value={percent} />

          {allKnown && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 px-4 py-3 text-sm font-medium text-[var(--success)]">
              <PartyPopper className="h-4 w-4" />
              Đã thuộc hết! 🎉
            </div>
          )}

          {/* Flashcard */}
          <div className="flip-card h-72 w-full">
            {/* Justified exception: large clickable content surface (the flip area),
                not a control — wrapping it in shadcn Button would fight the 3D flip
                layout. Kept as a native <button>. */}
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              aria-label="Lật thẻ"
              className="block h-full w-full text-left"
            >
              <div className={cn("flip-inner", flipped && "is-flipped")}>
                {/* FRONT: word + IPA / Hán tự + pinyin */}
                <div className="flip-face rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-flashcard)]">
                  {current.language === "zh" ? (
                    <HanziText large className="text-center">
                      {current.word}
                    </HanziText>
                  ) : (
                    <span className="text-center text-4xl font-bold">
                      {current.word}
                    </span>
                  )}
                  {current.language === "zh" && current.pinyin && (
                    <PinyinText size="lg" className="mt-2 font-medium">
                      {current.pinyin}
                    </PinyinText>
                  )}
                  {current.language === "en" && current.pronunciation && (
                    <span className="mt-2 text-base text-[var(--muted-foreground)]">
                      {current.pronunciation}
                    </span>
                  )}
                  <span className="mt-4 text-sm text-[var(--muted-foreground)]">
                    (Nhấn để lật)
                  </span>
                </div>
                {/* BACK: meaning + example + synonyms */}
                <div className="flip-face flip-back rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-flashcard)]">
                  <span className="text-center text-xl font-semibold">
                    {current.meaning}
                  </span>
                  {current.exampleSentence && (
                    <p className="mt-3 max-w-md text-center text-base italic text-[var(--muted-foreground)]">
                      “{current.exampleSentence}”
                    </p>
                  )}
                  {current.synonyms.length > 0 && (
                    <p className="mt-3 max-w-md text-center text-sm text-[var(--muted-foreground)]">
                      Đồng nghĩa: {current.synonyms.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* TTS for the current word (separate from the flip button). v6 — pass entry.language. */}
          {ttsOk && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => speak(current.word, current.language)}
                aria-label={`Phát âm ${current.word}`}
              >
                <Volume2 className="h-4 w-4" />
                Phát âm
              </Button>
            </div>
          )}

          {/* Nav */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={goPrev} disabled={index === 0}>
              <ChevronLeft className="h-4 w-4" />
              Trước
            </Button>
            <span className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              Thẻ {index + 1}/{total}
              {current.known && (
                <Badge variant="success">Đã thuộc</Badge>
              )}
            </span>
            <Button
              variant="ghost"
              onClick={goNext}
              disabled={index === total - 1}
            >
              Tiếp
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Mark buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={current.known ? "outline" : "destructive"}
              onClick={() => mark(false)}
              disabled={savingId === current.id}
              className="w-full"
            >
              <X className="h-4 w-4" />
              Chưa thuộc
            </Button>
            <Button
              variant={current.known ? "success" : "outline"}
              onClick={() => mark(true)}
              disabled={savingId === current.id}
              className="w-full"
            >
              <Check className="h-4 w-4" />
              Đã thuộc
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/vocabulary"
      className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    >
      <ArrowLeft className="h-4 w-4" />
      Quay lại
    </Link>
  );
}
