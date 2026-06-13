"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  RotateCcw,
  PartyPopper,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTopicDetail,
  markFlashcard,
  resetTopicProgress,
} from "@/hooks/useTopics";
import { useTopicReview } from "@/hooks/useTopicReview";
import type { Flashcard } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/states";
import { useAuthContext } from "@/components/auth-context";
import {
  ChineseFlashcardFront,
  ChineseFlashcardBack,
} from "@/components/chinese-flashcard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function TopicStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  // v6 amendment — pin slug lookup to the user's current language so the
  // (slug, language) compound resolves correctly and cache keys don't collide.
  const { user } = useAuthContext();
  const language = user.language ?? undefined;
  const { data, loading, error, refetch } = useTopicDetail(slug, language);
  // v3 — surface the SRS due-card badge. Failures are non-fatal: we just hide
  // the badge rather than blocking the topic page.
  const { data: review } = useTopicReview(slug, language);
  const dueCount = review?.dueCount ?? 0;

  // Local copy of cards so we can optimistically toggle `known`.
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getStoredUser()?.id ?? null);
  }, []);

  const isOwner = data !== null && userId !== null && data.userId === userId;

  useEffect(() => {
    if (data) {
      setCards(data.flashcards);
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

  // Keyboard: Space=flip, ArrowLeft/Right=nav
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
    // optimistic update
    setCards((cs) =>
      cs.map((c) => (c.id === id ? { ...c, known } : c)),
    );
    // tự chuyển sang thẻ kế tiếp ngay (không chờ API). Thẻ cuối thì giữ nguyên.
    if (index < total - 1) {
      goNext();
    } else {
      setFlipped(false);
    }
    setSavingId(id);
    try {
      await markFlashcard(id, known);
    } catch (err) {
      // revert thẻ vừa đánh dấu nếu lưu thất bại
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

  async function doReset() {
    setResetting(true);
    try {
      const res = await resetTopicProgress(slug);
      setCards((cs) => cs.map((c) => ({ ...c, known: false })));
      setIndex(0);
      setFlipped(false);
      toast.success(`Đã reset ${res.resetCount} thẻ về chưa thuộc`);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Không reset được.";
      toast.error(msg);
    } finally {
      setResetting(false);
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
          <BackLink />
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

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{data.titleVi}</h1>
            {dueCount > 0 && (
              <Link href={`/topics/${slug}/review`}>
                <Badge
                  variant="warning"
                  className="cursor-pointer hover:opacity-90"
                >
                  {dueCount} thẻ cần ôn
                </Badge>
              </Link>
            )}
          </div>
          <span className="text-sm text-[var(--muted-foreground)]">
            {knownCount}/{total} đã thuộc · {percent}%
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/topics/${slug}/manage`}>
                <Settings2 className="h-4 w-4" />
                Quản lý thẻ
              </Link>
            </Button>
          )}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={total === 0}>
              <RotateCcw className="h-4 w-4" />
              Reset ôn lại
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset tiến độ ôn lại?</DialogTitle>
              <DialogDescription>
                Tất cả thẻ trong topic này sẽ trở về trạng thái “chưa thuộc”.
                Hành động này không thể hoàn tác.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Hủy</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  onClick={doReset}
                  disabled={resetting}
                >
                  Reset
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Progress value={percent} />

      {total === 0 ? (
        <EmptyState
          title="Topic chưa có thẻ"
          description="Topic này hiện chưa có flashcard nào."
        />
      ) : (
        <>
          {allKnown && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 px-4 py-3 text-sm font-medium text-[var(--success)]">
              <PartyPopper className="h-4 w-4" />
              Đã thuộc hết! 🎉
            </div>
          )}

          {/* Flashcard — branches on topic.language (v6) */}
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
                {/* FRONT */}
                <div className="flip-face relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-flashcard)]">
                  {data.language === "zh" ? (
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
                {/* BACK */}
                <div className="flip-face flip-back rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-flashcard)]">
                  {data.language === "zh" ? (
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
            <Button
              variant="ghost"
              onClick={goPrev}
              disabled={index === 0}
            >
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
      href="/topics"
      className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    >
      <ArrowLeft className="h-4 w-4" />
      Quay lại
    </Link>
  );
}
