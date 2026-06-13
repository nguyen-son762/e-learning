"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useReadingAttempts } from "@/hooks/useReading";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { useAuthContext } from "@/components/auth-context";

export default function ReadingHistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  // v6 amendment — pin slug lookup to user's current language.
  const { user } = useAuthContext();
  const { data, loading, error, refetch } = useReadingAttempts(
    slug,
    user.language ?? undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/reading/${slug}`}
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </Link>

      <h1 className="text-2xl font-bold">Lịch sử làm bài</h1>

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {error &&
        (error.status === 404 ? (
          <EmptyState
            title="Không tìm thấy bài"
            description="Bài reading này không tồn tại."
          />
        ) : (
          <ErrorState message={error.message} onRetry={refetch} />
        ))}

      {!loading && !error && data && data.items.length === 0 && (
        <EmptyState
          title="Bạn chưa làm bài này lần nào"
          action={
            <Button asChild size="sm" className="w-fit">
              <Link href={`/reading/${slug}`}>Làm bài ngay</Link>
            </Button>
          }
        />
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <>
          <Card>
            <CardContent className="flex flex-col divide-y divide-[var(--border)] p-0">
              {data.items.map((a) => {
                const percent = Math.round((a.score / a.total) * 100);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <span className="text-sm text-[var(--muted-foreground)]">
                      {formatDateTime(a.createdAt)}
                    </span>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">
                        {a.score}/{a.total}
                      </Badge>
                      <span className="w-12 text-right text-sm font-medium">
                        {percent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Button asChild className="w-fit">
            <Link href={`/reading/${slug}`}>Làm lại bài này</Link>
          </Button>
        </>
      )}
    </div>
  );
}
