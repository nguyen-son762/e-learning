"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTopicReview } from "@/hooks/useTopicReview";
import { markFlashcard, type SrsQuality } from "@/hooks/useTopics";
import type { Flashcard } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/states";
import { useAuthContext } from "@/components/auth-context";
import {
  ChineseFlashcardFront,
  ChineseFlashcardBack,
} from "@/components/chinese-flashcard";

/**
 * SRS review session for a topic (Feature 5, v7 4-button rating).
 * Iterates the due-cards queue from GET /api/topics/:slug/review and sends a
 * `quality` 0|1|2|3 (Again/Hard/Good/Easy) per card.
 */
export default function TopicReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  // v6 — review only surfaces topics in user's current language, so
  // user.language is a safe proxy for the card variant.
  const { user, refresh } = useAuthContext();
  const language = user.language ?? "en";
  const { data, loading, error, refetch } = useTopicReview(slug, language);

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [reviewed, setReviewed] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  // v7 — last rating feedback ("Ôn lại sau: X ngày" + XP).
  const [lastFeedback, setLastFeedback] = useState<{
    days: number | null;
    xpEarned: number;
  } | null>(null);

  useEffect(() => {
    if (data) {
      setCards(data.items);
      setIndex(0);
      setFlipped(false);
      setReviewed(0);
      setLastFeedback(null);
    }
  }, [data]);

  const total = cards.length;
  const current = cards[index];
  const done = total > 0 && reviewed >= total;
  const percent = total === 0 ? 0 : Math.round((reviewed / total) * 100);

  const goNext = useCallback(() => {
    setFlipped(false);
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);
  const goPrev = useCallback(() => {
    setFlipped(false);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard: Space=flip, ArrowLeft/Right=nav. Number keys 1-4 = rate.
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

  async function rate(quality: SrsQuality) {
    if (!current) return;
    const id = current.id;
    // optimistic: bump reviewed counter, advance to next card.
    setReviewed((r) => r + 1);
    if (index < total - 1) {
      goNext();
    } else {
      setFlipped(false);
    }
    setSavingId(id);
    try {
      const res = await markFlashcard(id, quality);
      const days = daysUntil(res.nextReviewAt);
      setLastFeedback({ days, xpEarned: res.xpEarned });
      if (res.xpEarned > 0) {
        toast.success(`+${res.xpEarned} XP · 🔥 ${res.newStreak} ngày`);
      }
      // v7 — badges may be newly earned at XP/streak thresholds; refetch /me
      // so the TopNav + dashboard badge strip pick up the change.
      void refresh();
    } catch (err) {
      setReviewed((r) => Math.max(0, r - 1));
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
    if (error.status === 404) {
      return (
        <div className="flex flex-col gap-4">
          <BackLink slug={slug} />
          <EmptyState
            title="Không tìm thấy topic"
            description="Topic này không tồn tại."
          />
        </div>
      );
    }
    return <ErrorState message={error.message} onRetry={refetch} />;
  }
  if (!data) return null;

  if (data.dueCount === 0) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <BackLink slug={slug} />
        <div className="text-6xl">🎉</div>
        <h1 className="text-2xl font-bold">
          Không có thẻ nào cần ôn hôm nay
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Quay lại sau khi đến hạn ôn tập của các thẻ.
        </p>
        <Button asChild>
          <Link href={`/topics/${slug}`}>← Quay lại topic</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <BackLink slug={slug} />
        <div className="text-6xl">🎉</div>
        <h1 className="text-2xl font-bold">Hoàn thành ôn tập hôm nay!</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Bạn đã ôn {reviewed} thẻ
        </p>
        <Button asChild>
          <Link href={`/topics/${slug}`}>← Quay lại topic</Link>
        </Button>
      </div>
    );
  }

  if (!current) return null;
  const busy = savingId === current.id;

  return (
    <div className="flex flex-col gap-6">
      <BackLink slug={slug} />

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Ôn tập SRS</h1>
        <span className="text-sm text-[var(--muted-foreground)]">
          {reviewed}/{total} đã ôn · còn {total - reviewed} thẻ
        </span>
      </div>

      <Progress value={percent} />

      {/* Flashcard */}
      <div className="flip-card h-72 w-full">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label="Lật thẻ"
          className="block h-full w-full text-left"
        >
          <div className={cn("flip-inner", flipped && "is-flipped")}>
            <div className="flip-face relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-flashcard)]">
              {language === "zh" ? (
                <ChineseFlashcardFront hanzi={current.front} />
              ) : (
                <>
                  <span className="text-center text-4xl font-bold">
                    {current.front}
                  </span>
                  <span className="mt-4 text-sm text-[var(--muted-foreground)]">
                    (Nhấn để lật)
                  </span>
                </>
              )}
            </div>
            <div className="flip-face flip-back rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-flashcard)]">
              {language === "zh" ? (
                <ChineseFlashcardBack
                  back={current.back}
                  example={current.example}
                />
              ) : (
                <>
                  <span className="text-center text-xl font-semibold">
                    {current.back}
                  </span>
                  {current.example && (
                    <p className="mt-3 max-w-md text-center text-base italic text-[var(--muted-foreground)]">
                      “{current.example}”
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={goPrev} disabled={index === 0}>
          <ChevronLeft className="h-4 w-4" />
          Trước
        </Button>
        <span className="text-sm text-[var(--muted-foreground)]">
          Thẻ {index + 1}/{total}
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

      {/* v7 — 4-button SRS rating */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Button
          variant="destructive"
          onClick={() => rate(0)}
          disabled={busy}
          className="w-full"
        >
          Again
        </Button>
        <Button
          variant="outline"
          onClick={() => rate(1)}
          disabled={busy}
          className="w-full border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950"
        >
          Hard
        </Button>
        <Button
          variant="default"
          onClick={() => rate(2)}
          disabled={busy}
          className="w-full"
        >
          Good
        </Button>
        <Button
          variant="success"
          onClick={() => rate(3)}
          disabled={busy}
          className="w-full"
        >
          Easy
        </Button>
      </div>

      {/* v7 — feedback after last rating */}
      {lastFeedback && lastFeedback.days !== null && (
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          Ôn lại sau: {lastFeedback.days} ngày
          {lastFeedback.xpEarned > 0 && (
            <span className="ml-2">· +{lastFeedback.xpEarned} XP ⭐</span>
          )}
        </p>
      )}
    </div>
  );
}

/** Difference in whole days between an ISO timestamp and now (UTC-floored). */
function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diffMs = t - Date.now();
  return Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
}

function BackLink({ slug }: { slug: string }) {
  return (
    <Link
      href={`/topics/${slug}`}
      className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    >
      <ArrowLeft className="h-4 w-4" />
      Quay lại
    </Link>
  );
}
