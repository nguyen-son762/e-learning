"use client";

import Link from "next/link";
import { useReadingExercises } from "@/hooks/useReading";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { HskBadge } from "@/components/hsk-badge";
import type { HskLevel } from "@/lib/types";

/** v6 — parse "HSK1"/"HSK 2"/"hsk-3" → 1-6, null when out of shape. */
function parseHskLevel(level: string): HskLevel | null {
  const m = level.trim().toUpperCase().match(/^HSK[\s-]?([1-6])$/);
  return m ? (Number(m[1]) as HskLevel) : null;
}

export default function ReadingListPage() {
  const { data, loading, error, refetch } = useReadingExercises();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Reading</h1>

      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {error && <ErrorState message={error.message} onRetry={refetch} />}

      {!loading && !error && data && data.items.length === 0 && (
        <EmptyState
          title="Chưa có bài reading nào"
          description="Các bài luyện đọc sẽ xuất hiện ở đây."
        />
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {data.items.map((ex) => {
            const hsk = ex.language === "zh" ? parseHskLevel(ex.level) : null;
            return (
            <Card key={ex.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{ex.title}</CardTitle>
                  {hsk ? (
                    <HskBadge level={hsk} />
                  ) : (
                    <Badge variant="outline" className="capitalize">
                      {ex.level}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <p className="text-sm text-[var(--muted-foreground)]">
                  {ex.questionCount} câu hỏi · Điểm cao nhất:{" "}
                  {ex.bestScore === null
                    ? "Chưa làm"
                    : `${ex.bestScore}/${ex.questionCount}`}
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/reading/${ex.slug}`}>Làm bài</Link>
                </Button>
              </CardFooter>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
