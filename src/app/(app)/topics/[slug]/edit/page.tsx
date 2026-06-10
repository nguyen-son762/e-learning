"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useTopicDetail,
  updateTopic,
  deleteTopic,
} from "@/hooks/useTopics";
import { ApiError } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { EmptyState, ErrorState } from "@/components/states";

export default function EditTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { data, loading, error, refetch } = useTopicDetail(slug);

  const [title, setTitle] = useState("");
  const [titleVi, setTitleVi] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ownershipChecked, setOwnershipChecked] = useState(false);

  useEffect(() => {
    if (data) {
      const me = getStoredUser();
      if (!me || data.userId !== me.id) {
        toast.error("Bạn không có quyền sửa topic này.");
        router.replace("/topics");
        return;
      }
      setTitle(data.title);
      setTitleVi(data.titleVi);
      setDescription(data.description ?? "");
      setOwnershipChecked(true);
    }
  }, [data, router]);

  const trimmedTitle = title.trim();
  const trimmedTitleVi = titleVi.trim();
  const canSave =
    trimmedTitle.length >= 1 &&
    trimmedTitle.length <= 80 &&
    trimmedTitleVi.length >= 1 &&
    trimmedTitleVi.length <= 80 &&
    !saving;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const trimmedDesc = description.trim();
      await updateTopic(slug, {
        title: trimmedTitle,
        titleVi: trimmedTitleVi,
        description: trimmedDesc.length > 0 ? trimmedDesc : null,
      });
      toast.success("Đã lưu thay đổi.");
      router.push(`/topics/${slug}/manage`);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Không lưu được thay đổi.";
      setSaveError(msg);
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTopic(slug);
      toast.success("Đã xoá topic.");
      router.push("/topics");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Không xoá được topic.";
      toast.error(msg);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
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
  if (!data || !ownershipChecked) return null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <BackLink slug={slug} />

      <Card>
        <CardHeader>
          <CardTitle>Sửa thông tin topic</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Tiêu đề (English) *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                required
                disabled={saving}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="titleVi">Tiêu đề (Tiếng Việt) *</Label>
              <Input
                id="titleVi"
                value={titleVi}
                onChange={(e) => setTitleVi(e.target.value)}
                maxLength={80}
                required
                disabled={saving}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Mô tả (tuỳ chọn)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={saving}
              />
            </div>

            {saveError && (
              <p className="text-sm text-[var(--destructive)]">{saveError}</p>
            )}

            <Button
              type="submit"
              disabled={!canSave}
              className="w-full sm:w-auto sm:self-end"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-[var(--destructive)]/40">
        <CardHeader>
          <CardTitle className="text-[var(--destructive)]">
            Vùng nguy hiểm
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Xoá topic sẽ xoá vĩnh viễn topic này và tất cả flashcard bên trong.
            Hành động không thể hoàn tác.
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                <Trash2 className="h-4 w-4" />
                Xoá topic này
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Xoá topic vĩnh viễn?</DialogTitle>
                <DialogDescription>
                  Topic và tất cả {data.flashcardCount} thẻ sẽ bị xoá vĩnh
                  viễn. Hành động không thể hoàn tác.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={deleting}>
                    Huỷ
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Xoá vĩnh viễn
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

function BackLink({ slug }: { slug: string }) {
  return (
    <Link
      href={`/topics/${slug}/manage`}
      className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    >
      <ArrowLeft className="h-4 w-4" />
      Quay lại
    </Link>
  );
}
