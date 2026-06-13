"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredUser } from "@/lib/auth";
import { useDashboard } from "@/hooks/useDashboard";
import { formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/states";
import { ProgressChart } from "@/components/progress-chart";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
        <span className="text-2xl font-bold">{value}</span>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, loading, error, refetch } = useDashboard();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    setName(getStoredUser()?.name ?? "");
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />;
  }
  if (!data) return null;

  const { totals, topicProgress, recentAttempts } = data;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold">
        Xin chào{name ? `, ${name}` : ""} 👋
      </h1>

      {/* v7 — gamification stats: due today (lang-scoped) + streak + XP */}
      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Hôm nay cần ôn" value={String(data.dueToday)} />
        <StatTile label="🔥 Streak" value={`${data.streak} ngày`} />
        <StatTile label="⭐ XP" value={`${data.totalXP} XP`} />
      </div>

      {/* v7 — earned badges strip */}
      {data.badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.badges.map((b) => (
            <Badge key={b.id} variant="secondary" className="px-3 py-1 text-sm">
              🏆 {b.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Topics" value={String(totals.topicCount)} />
        <StatTile
          label="Đã thuộc"
          value={`${totals.knownCount}/${totals.flashcardCount}`}
        />
        <StatTile
          label="Hoàn thành"
          value={`${totals.overallCompletionPercent}%`}
        />
        <StatTile
          label="Bài đã làm"
          value={String(totals.readingAttemptCount)}
        />
      </div>

      {/* Progress chart (v3) */}
      <ProgressChart />

      {/* Topic progress */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Tiến độ theo topic</h2>
          <Link
            href="/topics"
            className="text-sm font-medium text-[var(--primary)] hover:underline"
          >
            Xem tất cả →
          </Link>
        </div>
        {topicProgress.items.length === 0 ? (
          <EmptyState
            title="Chưa có nội dung"
            description="Chưa có topic flashcard nào."
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col divide-y divide-[var(--border)] p-0">
              {topicProgress.items.map((t) => (
                <Link
                  key={t.id}
                  href={`/topics/${t.slug}`}
                  className="flex flex-col gap-2 p-4 transition-colors hover:bg-[var(--secondary)] sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="w-40 shrink-0 font-medium">{t.titleVi}</span>
                  <Progress
                    value={t.completionPercent}
                    className="flex-1"
                  />
                  <span className="shrink-0 text-sm text-[var(--muted-foreground)]">
                    {t.completionPercent}% · {t.knownCount}/{t.flashcardCount}{" "}
                    thẻ
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Recent attempts */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Bài reading gần đây</h2>
        {recentAttempts.items.length === 0 ? (
          <EmptyState
            title="Bạn chưa làm bài reading nào"
            action={
              <Button asChild size="sm" className="w-fit">
                <Link href="/reading">Bắt đầu</Link>
              </Button>
            }
          />
        ) : (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="sr-only">Bài reading gần đây</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-[var(--border)] p-0">
              {recentAttempts.items.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {a.exerciseTitle}
                    </span>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      {formatDate(a.createdAt)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant="secondary">
                      {a.score}/{a.total}
                    </Badge>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/reading/${a.exerciseSlug}`}>Làm lại</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
