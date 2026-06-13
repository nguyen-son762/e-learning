"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { createVocabulary } from "@/hooks/useVocabulary";
import type { VocabularyInput } from "@/lib/types";
import { useAuthContext } from "@/components/auth-context";
import { VocabularyForm } from "@/components/vocabulary-form";

export default function NewVocabularyPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  // v6 — gated by (app)/layout: user.language is non-null here.
  const language = user.language ?? "en";

  async function handleSubmit(input: VocabularyInput) {
    await createVocabulary(input);
    toast.success("Đã thêm từ mới.");
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

      <h1 className="text-3xl font-bold">Thêm từ mới</h1>

      <VocabularyForm
        language={language}
        submitLabel="Lưu từ"
        onSubmit={handleSubmit}
        showDictionary
      />
    </div>
  );
}
