"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createTopic } from "@/hooks/useTopics";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NewTopicPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [titleVi, setTitleVi] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  const trimmedTitleVi = titleVi.trim();
  const canSubmit =
    trimmedTitle.length >= 1 &&
    trimmedTitle.length <= 80 &&
    trimmedTitleVi.length >= 1 &&
    trimmedTitleVi.length <= 80 &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const trimmedDesc = description.trim();
      const created = await createTopic({
        title: trimmedTitle,
        titleVi: trimmedTitleVi,
        ...(trimmedDesc ? { description: trimmedDesc } : {}),
      });
      toast.success("Đã tạo topic.");
      router.push(`/topics/${created.slug}/manage`);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Không tạo được topic.";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <Link
        href="/topics"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Tạo topic mới</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Tiêu đề (English) *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Travel Words"
                maxLength={80}
                required
                disabled={submitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="titleVi">Tiêu đề (Tiếng Việt) *</Label>
              <Input
                id="titleVi"
                value={titleVi}
                onChange={(e) => setTitleVi(e.target.value)}
                placeholder="Từ vựng du lịch"
                maxLength={80}
                required
                disabled={submitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Mô tả (tuỳ chọn)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ghi chú ngắn về topic này…"
                rows={3}
                disabled={submitting}
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--destructive)]">{error}</p>
            )}

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full sm:w-auto sm:self-end"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Tạo topic
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
