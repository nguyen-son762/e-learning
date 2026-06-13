"use client";

/**
 * v8 — Manage page for Personal Vocabulary Topics.
 *
 * Scoped to `user.language`. List + create + rename + change-color + delete.
 *
 * Per-topic vocabulary counts are computed CLIENT-SIDE by issuing a single
 * `GET /api/vocabulary?language=<L>` and bucketing entries by `vocabularyTopicId`
 * — the contract intentionally keeps `VocabularyTopic` minimal (no count field)
 * and the route-map (line 33) calls out this bucketing strategy.
 *
 * Clicking a card deep-links to `/vocabulary?vocabularyTopicId=<id>`.
 * Delete uses the project's `ConfirmDialog` (a destructive shadcn Dialog with
 * the project's Vietnamese cancel/confirm wording).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useVocabularyTopics,
  deleteVocabularyTopic,
  updateVocabularyTopic,
} from "@/hooks/useVocabularyTopics";
import { useVocabulary } from "@/hooks/useVocabulary";
import { ApiError } from "@/lib/api";
import type { VocabularyTopic } from "@/lib/types";
import { useAuthContext } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  VocabularyTopicDialog,
  TOPIC_COLOR_PALETTE,
} from "@/components/vocabulary-topic-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const LANGUAGE_LABEL = { en: "Tiếng Anh", zh: "Tiếng Trung" } as const;

export default function VocabularyTopicsPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const language = user.language ?? "en";

  const { data, loading, error, refetch } = useVocabularyTopics(language);
  // Single GET /api/vocabulary call (language-scoped) for client-side bucketing.
  const { data: vocabData } = useVocabulary({ language });

  // Local cache (so create/rename/delete reflect immediately).
  const [topics, setTopics] = useState<VocabularyTopic[]>([]);
  useEffect(() => {
    if (data) setTopics(data.items);
  }, [data]);

  // Per-topic counts (entries whose vocabularyTopicId matches). Untagged not shown here.
  const countsByTopicId = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of vocabData?.items ?? []) {
      if (e.vocabularyTopicId) {
        m.set(e.vocabularyTopicId, (m.get(e.vocabularyTopicId) ?? 0) + 1);
      }
    }
    return m;
  }, [vocabData]);

  // Dialog state — shared between create and rename.
  const [dialog, setDialog] = useState<
    | { mode: "create" }
    | { mode: "rename"; topic: VocabularyTopic }
    | { mode: "closed" }
  >({ mode: "closed" });

  // Confirm delete state.
  const [confirmTopic, setConfirmTopic] = useState<VocabularyTopic | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [colorBusyId, setColorBusyId] = useState<string | null>(null);

  function upsertTopic(t: VocabularyTopic) {
    setTopics((cur) => {
      const without = cur.filter((x) => x.id !== t.id);
      return [...without, t].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    });
  }

  async function confirmDelete() {
    const t = confirmTopic;
    if (!t) return;
    setDeleting(true);
    try {
      await deleteVocabularyTopic(t.id);
      setTopics((cur) => cur.filter((x) => x.id !== t.id));
      toast.success(`Đã xoá chủ đề "${t.name}".`);
      setConfirmTopic(null);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Không xoá được chủ đề.";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function pickColor(t: VocabularyTopic, color: string | null) {
    setColorBusyId(t.id);
    try {
      const updated = await updateVocabularyTopic(t.id, { color });
      upsertTopic(updated);
      toast.success("Đã đổi màu.");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Không đổi được màu.";
      toast.error(msg);
    } finally {
      setColorBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/vocabulary"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại danh sách
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">Chủ đề từ vựng</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Đang quản lý chủ đề trong {LANGUAGE_LABEL[language]}.
          </p>
        </div>
        <Button onClick={() => setDialog({ mode: "create" })}>
          <Plus className="h-4 w-4" />
          Tạo chủ đề
        </Button>
      </div>

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState message={error.message} onRetry={refetch} />}

      {!loading && !error && topics.length === 0 && (
        <EmptyState
          title="Chưa có chủ đề nào"
          description="Tạo chủ đề đầu tiên để nhóm các từ vựng theo mục đích học."
          action={
            <Button onClick={() => setDialog({ mode: "create" })} className="w-fit">
              <Plus className="h-4 w-4" />
              Tạo chủ đề
            </Button>
          }
        />
      )}

      {!loading && !error && topics.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => {
            const count = countsByTopicId.get(t.id) ?? 0;
            return (
              <Card
                key={t.id}
                className="cursor-pointer transition-shadow hover:shadow-[var(--shadow-card-hover)]"
                onClick={() =>
                  router.push(`/vocabulary?vocabularyTopicId=${t.id}`)
                }
              >
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "inline-block h-3 w-3 shrink-0 rounded-full",
                          !t.color && "border border-[var(--border)]",
                        )}
                        style={
                          t.color ? { backgroundColor: t.color } : undefined
                        }
                      />
                      <span className="truncate text-base font-semibold">
                        {t.name}
                      </span>
                    </div>
                    {/* Click actions: stop propagation so the card-link doesn't fire. */}
                    <div
                      className="flex shrink-0 items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Đổi màu chủ đề ${t.name}`}
                            disabled={colorBusyId === t.id}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "inline-block h-4 w-4 rounded-full",
                                !t.color && "border border-[var(--border)]",
                              )}
                              style={
                                t.color
                                  ? { backgroundColor: t.color }
                                  : undefined
                              }
                            />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto" align="end">
                          <div className="flex max-w-[12rem] flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => pickColor(t, null)}
                              aria-label="Bỏ màu"
                              aria-pressed={t.color === null}
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs",
                                t.color === null
                                  ? "border-[var(--primary)] bg-[var(--secondary)]"
                                  : "border-[var(--border)] bg-transparent",
                              )}
                            >
                              ✕
                            </button>
                            {TOPIC_COLOR_PALETTE.map((hex) => (
                              <button
                                key={hex}
                                type="button"
                                onClick={() => pickColor(t, hex)}
                                aria-label={`Chọn màu ${hex}`}
                                aria-pressed={t.color === hex}
                                style={{ backgroundColor: hex }}
                                className={cn(
                                  "h-7 w-7 rounded-full border-2 transition-transform",
                                  t.color === hex
                                    ? "scale-110 border-[var(--foreground)]"
                                    : "border-transparent",
                                )}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDialog({ mode: "rename", topic: t })}
                        aria-label={`Đổi tên chủ đề ${t.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmTopic(t)}
                        aria-label={`Xoá chủ đề ${t.name}`}
                        className="text-[var(--destructive)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {count} từ vựng
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / rename dialog */}
      <VocabularyTopicDialog
        open={dialog.mode !== "closed"}
        mode={dialog.mode === "rename" ? "rename" : "create"}
        language={language}
        topic={dialog.mode === "rename" ? dialog.topic : undefined}
        onSuccess={(t) => {
          upsertTopic(t);
          setDialog({ mode: "closed" });
        }}
        onClose={() => setDialog({ mode: "closed" })}
      />

      {/* Destructive delete confirm — wording per design-architect's broadcast. */}
      <ConfirmDialog
        open={confirmTopic !== null}
        title="Xoá chủ đề?"
        description={
          confirmTopic
            ? `${countsByTopicId.get(confirmTopic.id) ?? 0} từ vựng sẽ bị bỏ gắn (không bị xoá). Tiếp tục?`
            : ""
        }
        confirmLabel="Xoá chủ đề"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTopic(null)}
      />
    </div>
  );
}
