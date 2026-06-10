"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus,
  GraduationCap,
  Search,
  Star,
  Volume2,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useVocabulary,
  useVocabularyTags,
  setVocabularyFavorite,
  deleteVocabulary,
} from "@/hooks/useVocabulary";
import { PARTS_OF_SPEECH } from "@/components/vocabulary-form";
import type { VocabularyEntry, VocabularyListParams } from "@/lib/types";
import { ApiError } from "@/lib/api";
import { speak, isTtsSupported } from "@/lib/tts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Sentinel for "all tags/pos" — Radix Select disallows an empty-string value. */
const TAG_ALL = "__all__";
const POS_ALL = "__pos_all__";

const SORTS: { value: NonNullable<VocabularyListParams["sort"]>; label: string }[] =
  [
    { value: "newest", label: "Mới nhất" },
    { value: "oldest", label: "Cũ nhất" },
    { value: "az", label: "A → Z" },
  ];

export default function VocabularyListPage() {
  const ttsOk = isTtsSupported();

  // Filter/sort state → query params.
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sort, setSort] = useState<NonNullable<VocabularyListParams["sort"]>>(
    "newest",
  );

  const params: VocabularyListParams = useMemo(
    () => ({
      search: search || undefined,
      tag: tag || undefined,
      partOfSpeech: partOfSpeech || undefined,
      favorite: favoriteOnly ? "true" : undefined,
      sort,
    }),
    [search, tag, partOfSpeech, favoriteOnly, sort],
  );

  const { data, loading, error, refetch } = useVocabulary(params);
  const { data: tagsData } = useVocabularyTags();

  // Local optimistic copy so favorite-toggle / delete reflect immediately.
  const items = data?.items ?? [];
  const [favOverride, setFavOverride] = useState<Record<string, boolean>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmEntry, setConfirmEntry] = useState<VocabularyEntry | null>(null);

  const visible = items.filter((e) => !deletedIds.has(e.id));

  async function toggleFavorite(entry: VocabularyEntry) {
    const current = favOverride[entry.id] ?? entry.isFavorite;
    const next = !current;
    setFavOverride((o) => ({ ...o, [entry.id]: next })); // optimistic
    setBusyId(entry.id);
    try {
      await setVocabularyFavorite(entry.id, next);
    } catch (err) {
      setFavOverride((o) => ({ ...o, [entry.id]: current })); // revert
      const msg =
        err instanceof ApiError ? err.message : "Không cập nhật được yêu thích.";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const entry = confirmEntry;
    if (!entry) return;
    setConfirmEntry(null);
    setBusyId(entry.id);
    setDeletedIds((s) => new Set(s).add(entry.id)); // optimistic
    try {
      await deleteVocabulary(entry.id);
      toast.success(`Đã xoá “${entry.word}”.`);
    } catch (err) {
      setDeletedIds((s) => {
        const next = new Set(s);
        next.delete(entry.id);
        return next;
      });
      const msg = err instanceof ApiError ? err.message : "Không xoá được từ.";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Từ vựng của tôi</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/vocabulary/study">
              <GraduationCap className="h-4 w-4" />
              Học
            </Link>
          </Button>
          <Button asChild>
            <Link href="/vocabulary/new">
              <Plus className="h-4 w-4" />
              Thêm từ
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo từ hoặc nghĩa…"
            className="pl-9"
            aria-label="Tìm từ vựng"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={tag || TAG_ALL}
            onValueChange={(v) => setTag(v === TAG_ALL ? "" : v)}
          >
            <SelectTrigger className="h-9 w-40" aria-label="Lọc theo thẻ">
              <SelectValue placeholder="Tất cả thẻ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TAG_ALL}>Tất cả thẻ</SelectItem>
              {(tagsData?.items ?? []).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={partOfSpeech || POS_ALL}
            onValueChange={(v) => setPartOfSpeech(v === POS_ALL ? "" : v)}
          >
            <SelectTrigger className="h-9 w-44" aria-label="Lọc theo loại từ">
              <SelectValue placeholder="Tất cả loại từ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={POS_ALL}>Tất cả loại từ</SelectItem>
              {PARTS_OF_SPEECH.map((pos) => (
                <SelectItem key={pos.value} value={pos.value}>
                  {pos.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(v) =>
              setSort(v as NonNullable<VocabularyListParams["sort"]>)
            }
          >
            <SelectTrigger className="h-9 w-40" aria-label="Sắp xếp">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={favoriteOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFavoriteOnly((v) => !v)}
          >
            <Star
              className={cn("h-4 w-4", favoriteOnly && "fill-current")}
            />
            Yêu thích
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState message={error.message} onRetry={refetch} />}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          title="Chưa có từ nào"
          description="Hãy thêm từ vựng đầu tiên của bạn để bắt đầu học."
          action={
            <Button asChild className="w-fit">
              <Link href="/vocabulary/new">
                <Plus className="h-4 w-4" />
                Thêm từ
              </Link>
            </Button>
          }
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="flex flex-col gap-3">
          {visible.map((entry) => {
            const fav = favOverride[entry.id] ?? entry.isFavorite;
            return (
              <Card key={entry.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{entry.word}</CardTitle>
                        {entry.pronunciation && (
                          <span className="text-sm text-[var(--muted-foreground)]">
                            {entry.pronunciation}
                          </span>
                        )}
                        {entry.partOfSpeech && (
                          <Badge variant="secondary">
                            {entry.partOfSpeech}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-[var(--foreground)]">
                        {entry.meaning}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleFavorite(entry)}
                        disabled={busyId === entry.id}
                        aria-label={
                          fav ? "Bỏ yêu thích" : "Đánh dấu yêu thích"
                        }
                        aria-pressed={fav}
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            fav
                              ? "fill-[var(--warning)] text-[var(--warning)]"
                              : "text-[var(--muted-foreground)]",
                          )}
                        />
                      </Button>
                      {ttsOk && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => speak(entry.word)}
                          aria-label={`Phát âm ${entry.word}`}
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        aria-label={`Sửa ${entry.word}`}
                      >
                        <Link href={`/vocabulary/${entry.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmEntry(entry)}
                        disabled={busyId === entry.id}
                        aria-label={`Xoá ${entry.word}`}
                        className="text-[var(--destructive)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {entry.tags.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {entry.tags.map((t) => (
                        <Badge key={t} variant="outline">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirm dialog */}
      <Dialog
        open={confirmEntry !== null}
        onOpenChange={(open) => !open && setConfirmEntry(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá từ này?</DialogTitle>
            <DialogDescription>
              {confirmEntry
                ? `“${confirmEntry.word}” sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Hủy</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDelete}>
              Xoá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
