"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useVocabularyEntry, updateVocabulary } from "@/hooks/useVocabulary";
import type { VocabularyInput } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { VocabularyForm, stateFromEntry } from "@/components/vocabulary-form";

export default function EditVocabularyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, loading, error, refetch } = useVocabularyEntry(id);

  async function handleSubmit(input: VocabularyInput) {
    await updateVocabulary(id, input);
    toast.success("Đã cập nhật từ.");
    router.push("/vocabulary");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        href="/vocabulary"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </Link>

      <h1 className="text-3xl font-bold">Sửa từ</h1>

      {loading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {error &&
        (error.status === 404 ? (
          <EmptyState
            title="Không tìm thấy từ"
            description="Từ này không tồn tại hoặc không thuộc về bạn."
          />
        ) : (
          <ErrorState message={error.message} onRetry={refetch} />
        ))}

      {!loading && !error && data && (
        <VocabularyForm
          /* v6 — edit form branches on entry.language (immutable per spec). */
          language={data.language}
          initial={stateFromEntry(data)}
          submitLabel="Lưu thay đổi"
          onSubmit={handleSubmit}
          showDictionary
        />
      )}
    </div>
  );
}
