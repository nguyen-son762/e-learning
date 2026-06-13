"use client";

import { use, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, X, History, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useReadingExercise,
  submitReadingAttempt,
} from "@/hooks/useReading";
import type { ReadingAttemptResult } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState } from "@/components/states";
import { SelectionPopover } from "@/components/selection-popover";
import { useAuthContext } from "@/components/auth-context";
import { HanziText } from "@/components/hanzi-text";
import { HskBadge } from "@/components/hsk-badge";
import type { HskLevel } from "@/lib/types";

/**
 * v6 — parse the `level` string of a zh reading exercise into a HSK numeric.
 * Accepts "HSK1" / "HSK 2" / "hsk-3" etc.; returns null when the string is
 * out of range or doesn't match, in which case we fall back to the raw
 * Badge so unfamiliar levels still render.
 */
function parseHskLevel(level: string): HskLevel | null {
  const m = level.trim().toUpperCase().match(/^HSK[\s-]?([1-6])$/);
  if (!m) return null;
  return Number(m[1]) as HskLevel;
}

export default function ReadingExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  // v6 amendment — pin slug lookup to user's current language so the
  // (slug, language) compound resolves correctly and cache keys don't collide.
  const { user } = useAuthContext();
  const { data, loading, error, refetch } = useReadingExercise(
    slug,
    user.language ?? undefined,
  );

  // answers[order] = selected option index, -1 = unanswered
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReadingAttemptResult | null>(null);
  const passageRef = useRef<HTMLDivElement | null>(null);

  const questions = useMemo(
    () => (data ? [...data.questions].sort((a, b) => a.order - b.order) : []),
    [data],
  );

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => answers[q.order] !== undefined);

  async function onSubmit() {
    if (!data) return;
    // Build aligned-by-order array, -1 for unanswered.
    const payload = questions.map((q) =>
      answers[q.order] === undefined ? -1 : answers[q.order],
    );
    setSubmitting(true);
    try {
      const res = await submitReadingAttempt(slug, payload);
      setResult(res);
      toast.success(`Kết quả: ${res.score}/${res.total}`);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Không nộp được bài.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setResult(null);
    setAnswers({});
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    if (error.status === 404) {
      return (
        <div className="flex flex-col gap-4">
          <BackLink />
          <EmptyState
            title="Không tìm thấy bài"
            description="Bài reading này không tồn tại."
          />
        </div>
      );
    }
    return <ErrorState message={error.message} onRetry={refetch} />;
  }
  if (!data) return null;

  const reviewQuestions = result
    ? [...result.questions].sort((a, b) => a.order - b.order)
    : null;
  const percent = result
    ? Math.round((result.score / result.total) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <BackLink />
        <Button asChild variant="ghost" size="sm">
          <Link href={`/reading/${slug}/history`}>
            <History className="h-4 w-4" />
            Lịch sử
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        {(() => {
          // v6 — zh exercises carry HSK-style levels; render via HskBadge when
          // parseable, else fall back to the raw Badge.
          const hsk =
            data.language === "zh" ? parseHskLevel(data.level) : null;
          return hsk ? (
            <HskBadge level={hsk} />
          ) : (
            <Badge variant="outline" className="capitalize">
              {data.level}
            </Badge>
          );
        })()}
      </div>

      {/* Passage — v6: Hán tự rendering for zh exercises (lang + CJK font chain). */}
      <Card>
        <CardContent className="max-h-80 overflow-y-auto p-6">
          <div ref={passageRef}>
            {data.language === "zh" ? (
              <HanziText
                as="p"
                large={false}
                className="whitespace-pre-line text-lg leading-relaxed"
              >
                {data.passage}
              </HanziText>
            ) : (
              <p className="whitespace-pre-line leading-relaxed">
                {data.passage}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* v3 — highlight 1–5 words to add to vocabulary. Disabled after submit. */}
      <SelectionPopover
        containerRef={passageRef}
        enabled={!result}
        passageText={data.passage}
      />


      {/* Review mode */}
      {result && reviewQuestions ? (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">Kết quả</p>
            <p className="text-3xl font-bold">
              {result.score}/{result.total}{" "}
              <span className="text-[var(--muted-foreground)]">
                ({percent}%)
              </span>
            </p>
          </div>

          <ol className="flex flex-col gap-4">
            {reviewQuestions.map((q, i) => (
              <li
                key={q.id}
                className="rounded-lg border border-[var(--border)] p-4"
              >
                <div className="flex items-start gap-2">
                  {q.correct ? (
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--success)]" />
                  ) : (
                    <X className="mt-0.5 h-5 w-5 shrink-0 text-[var(--destructive)]" />
                  )}
                  <p className="font-medium">
                    Câu {i + 1}. {q.prompt}
                  </p>
                </div>
                <ul className="mt-3 flex flex-col gap-1.5 pl-7">
                  {q.options.map((opt, idx) => {
                    const isCorrect = idx === q.correctIndex;
                    const isSelected = idx === q.selectedIndex;
                    return (
                      <li
                        key={idx}
                        className={cn(
                          "rounded-md px-2 py-1 text-sm",
                          isCorrect &&
                            "bg-[var(--success)]/10 font-medium text-[var(--success)]",
                          isSelected &&
                            !isCorrect &&
                            "bg-[var(--destructive)]/10 text-[var(--destructive)]",
                        )}
                      >
                        {opt}
                        {isCorrect && " ✓ (đáp án đúng)"}
                        {isSelected && !isCorrect && " ✗ (bạn chọn)"}
                      </li>
                    );
                  })}
                  {q.selectedIndex === -1 && (
                    <li className="px-2 text-sm italic text-[var(--muted-foreground)]">
                      (Bạn chưa trả lời)
                    </li>
                  )}
                </ul>
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={retry} className="w-full sm:w-auto">
              Làm lại
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href={`/reading/${slug}/history`}>Xem lịch sử</Link>
            </Button>
          </div>
        </div>
      ) : (
        /* Answer mode */
        <div className="flex flex-col gap-6">
          <ol className="flex flex-col gap-6">
            {questions.map((q, i) => (
              <li key={q.id} className="flex flex-col gap-3">
                <p className="font-medium">
                  Câu {i + 1}. {q.prompt}
                </p>
                <RadioGroup
                  value={
                    answers[q.order] !== undefined
                      ? String(answers[q.order])
                      : undefined
                  }
                  onValueChange={(v) =>
                    setAnswers((a) => ({ ...a, [q.order]: Number(v) }))
                  }
                  className="gap-2"
                >
                  {q.options.map((opt, idx) => {
                    const id = `${q.id}-${idx}`;
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <RadioGroupItem value={String(idx)} id={id} />
                        <Label htmlFor={id} className="cursor-pointer font-normal">
                          {opt}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </li>
            ))}
          </ol>

          <div className="flex flex-col items-center gap-2">
            {!allAnswered && (
              <p className="text-sm text-[var(--muted-foreground)]">
                Bạn còn câu chưa trả lời — câu bỏ trống sẽ tính là sai.
              </p>
            )}
            <Button
              onClick={onSubmit}
              disabled={submitting || questions.length === 0}
              size="lg"
            >
              {submitting && <Loader2 className="animate-spin" />}
              Nộp bài
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/reading"
      className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    >
      <ArrowLeft className="h-4 w-4" />
      Quay lại
    </Link>
  );
}
