"use client";

import Link from "next/link";
import { useTopics } from "@/hooks/useTopics";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";

export default function TopicsPage() {
  const { data, loading, error, refetch } = useTopics();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Flashcard</h1>

      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      )}

      {error && <ErrorState message={error.message} onRetry={refetch} />}

      {!loading && !error && data && data.items.length === 0 && (
        <EmptyState
          title="Chưa có topic nào"
          description="Nội dung flashcard sẽ xuất hiện ở đây."
        />
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {data.items.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{t.titleVi}</CardTitle>
                  <Badge variant="secondary">{t.completionPercent}%</Badge>
                </div>
                {t.description && (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {t.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-end gap-2 pb-4">
                <Progress value={t.completionPercent} />
                <span className="text-sm text-[var(--muted-foreground)]">
                  {t.knownCount}/{t.flashcardCount} thẻ đã thuộc
                </span>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/topics/${t.slug}`}>Học ngay</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
