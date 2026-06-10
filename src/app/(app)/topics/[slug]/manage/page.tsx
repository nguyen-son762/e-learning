"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useTopicDetail,
  addFlashcard,
  updateFlashcard,
  deleteFlashcard,
} from "@/hooks/useTopics";
import { ApiError } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import type { Flashcard } from "@/lib/types";
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

export default function ManageTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { data, loading, error, refetch } = useTopicDetail(slug);

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [ownershipChecked, setOwnershipChecked] = useState(false);

  useEffect(() => {
    if (data) {
      setCards(data.flashcards);
      const me = getStoredUser();
      if (!me || data.userId !== me.id) {
        toast.error("Bạn không có quyền quản lý topic này.");
        router.replace("/topics");
        return;
      }
      setOwnershipChecked(true);
    }
  }, [data, router]);

  async function handleAdd(input: {
    front: string;
    back: string;
    example?: string;
  }) {
    const created = await addFlashcard(slug, input);
    setCards((cs) => [...cs, created]);
    setAdding(false);
    toast.success("Đã thêm thẻ mới.");
  }

  async function handleUpdate(
    id: string,
    patch: { front?: string; back?: string; example?: string | null },
  ) {
    const updated = await updateFlashcard(id, patch);
    setCards((cs) => cs.map((c) => (c.id === id ? updated : c)));
    setEditingId(null);
    toast.success("Đã cập nhật thẻ.");
  }

  async function handleDelete(id: string) {
    const prev = cards;
    setCards((cs) => cs.filter((c) => c.id !== id));
    try {
      await deleteFlashcard(id);
      toast.success("Đã xoá thẻ.");
    } catch (err) {
      setCards(prev);
      const msg =
        err instanceof ApiError ? err.message : "Không xoá được thẻ.";
      toast.error(msg);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-12 w-full" />
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
    <div className="flex flex-col gap-6">
      <BackLink />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{data.titleVi}</h1>
          <span className="text-sm text-[var(--muted-foreground)]">
            {cards.length} thẻ · Quản lý nội dung
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/topics/${slug}/edit`}>
              <Settings2 className="h-4 w-4" />
              Sửa thông tin
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/topics/${slug}`}>Học ngay</Link>
          </Button>
        </div>
      </div>

      {cards.length === 0 && !adding ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <p className="text-center text-[var(--muted-foreground)]">
              Topic chưa có thẻ nào
            </p>
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" />
              Thêm thẻ đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((c) =>
            editingId === c.id ? (
              <FlashcardForm
                key={c.id}
                initial={c}
                submitLabel="Lưu"
                onCancel={() => setEditingId(null)}
                onSubmit={(input) =>
                  handleUpdate(c.id, {
                    front: input.front,
                    back: input.back,
                    example: input.example ?? null,
                  })
                }
              />
            ) : (
              <FlashcardRow
                key={c.id}
                card={c}
                onEdit={() => setEditingId(c.id)}
                onDelete={() => handleDelete(c.id)}
              />
            ),
          )}

          {adding && (
            <FlashcardForm
              submitLabel="Thêm"
              onCancel={() => setAdding(false)}
              onSubmit={handleAdd}
            />
          )}

          {!adding && (
            <Button
              variant="outline"
              onClick={() => setAdding(true)}
              className="self-start"
            >
              <Plus className="h-4 w-4" />
              Thêm thẻ
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FlashcardRow({
  card,
  onEdit,
  onDelete,
}: {
  card: Flashcard;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-4">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-base font-semibold">{card.front}</span>
            <span className="text-sm text-[var(--muted-foreground)]">
              {card.back}
            </span>
          </div>
          {card.example && (
            <p className="text-sm italic text-[var(--muted-foreground)]">
              ví dụ: {card.example}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sửa thẻ"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Xoá thẻ"
                className="text-[var(--destructive)] hover:text-[var(--destructive)]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Xoá thẻ này?</DialogTitle>
                <DialogDescription>
                  Thẻ &ldquo;{card.front}&rdquo; sẽ bị xoá vĩnh viễn.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Hủy</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive" onClick={onDelete}>
                    Xoá
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

function FlashcardForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Flashcard;
  submitLabel: string;
  onSubmit: (input: {
    front: string;
    back: string;
    example?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  const [example, setExample] = useState(initial?.example ?? "");
  const [submitting, setSubmitting] = useState(false);

  const trimmedFront = front.trim();
  const trimmedBack = back.trim();
  const canSubmit =
    trimmedFront.length > 0 && trimmedBack.length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const trimmedExample = example.trim();
      await onSubmit({
        front: trimmedFront,
        back: trimmedBack,
        ...(trimmedExample ? { example: trimmedExample } : {}),
      });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Không lưu được thẻ.";
      toast.error(msg);
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="py-4">
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fc-front">Mặt trước *</Label>
              <Input
                id="fc-front"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                placeholder="airport"
                required
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fc-back">Mặt sau *</Label>
              <Input
                id="fc-back"
                value={back}
                onChange={(e) => setBack(e.target.value)}
                placeholder="sân bay"
                required
                disabled={submitting}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fc-example">Ví dụ (tuỳ chọn)</Label>
            <Textarea
              id="fc-example"
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="We arrived at the airport early."
              rows={2}
              disabled={submitting}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
