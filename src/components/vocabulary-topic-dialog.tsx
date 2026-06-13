"use client";

/**
 * v8 — Create / rename modal for personal Vocabulary Topics.
 *
 * Shared between `/vocabulary/topics` (manage page) and `/vocabulary/new` +
 * `/vocabulary/[id]/edit` (inline "+ Tạo chủ đề mới" affordance on the form).
 *
 * On 409 TOPIC_NAME_CONFLICT, the contract guarantees a uniform error envelope;
 * we surface a Vietnamese-localized message AND keep the dialog open with the
 * typed name preserved so the user can rename without re-entering data.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createVocabularyTopic,
  updateVocabularyTopic,
} from "@/hooks/useVocabularyTopics";
import { ApiError } from "@/lib/api";
import type { Language, VocabularyTopic } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Default palette — 8 brand-neutral hex colors users can pick. */
export const TOPIC_COLOR_PALETTE: string[] = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#0EA5E9", // sky
  "#6366F1", // indigo
  "#A855F7", // violet
  "#EC4899", // pink
];

const LANGUAGE_LABEL: Record<Language, string> = {
  en: "Tiếng Anh",
  zh: "Tiếng Trung",
};

interface VocabularyTopicDialogProps {
  open: boolean;
  /**
   * Mode "create" → POST /api/vocabulary-topics with the chosen `language`.
   * Mode "rename" → PATCH /api/vocabulary-topics/:id (language NOT sent).
   */
  mode: "create" | "rename";
  language: Language; // v8 — topics are language-scoped; immutable after create.
  /** When mode === "rename", pre-fills with this topic; required in that mode. */
  topic?: VocabularyTopic;
  /** Fires after a successful create/rename with the resulting topic. */
  onSuccess: (topic: VocabularyTopic) => void;
  onClose: () => void;
}

export function VocabularyTopicDialog({
  open,
  mode,
  language,
  topic,
  onSuccess,
  onClose,
}: VocabularyTopicDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset form whenever the dialog opens (or the topic-to-rename changes).
  useEffect(() => {
    if (!open) return;
    if (mode === "rename" && topic) {
      setName(topic.name);
      setColor(topic.color);
    } else {
      setName("");
      setColor(null);
    }
  }, [open, mode, topic]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Vui lòng nhập tên chủ đề.");
      return;
    }
    if (trimmed.length > 60) {
      toast.error("Tên chủ đề tối đa 60 ký tự.");
      return;
    }
    setSubmitting(true);
    try {
      const result =
        mode === "create"
          ? await createVocabularyTopic({
              name: trimmed,
              color,
              language,
            })
          : await updateVocabularyTopic(topic!.id, {
              name: trimmed,
              color,
            });
      toast.success(
        mode === "create" ? "Đã tạo chủ đề." : "Đã cập nhật chủ đề.",
      );
      onSuccess(result);
    } catch (err) {
      if (err instanceof ApiError && err.code === "TOPIC_NAME_CONFLICT") {
        // Keep dialog open, preserve typed name — user can rename inline.
        toast.error(
          `Bạn đã có chủ đề tên "${trimmed}" trong ${LANGUAGE_LABEL[language]}.`,
        );
      } else {
        const msg =
          err instanceof ApiError
            ? err.message
            : mode === "create"
              ? "Không tạo được chủ đề."
              : "Không cập nhật được chủ đề.";
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tạo chủ đề từ vựng" : "Đổi tên chủ đề"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? `Chủ đề mới sẽ thuộc về ${LANGUAGE_LABEL[language]}. Tên không thể trùng với chủ đề khác cùng ngôn ngữ.`
              : "Sửa tên hoặc màu nhãn của chủ đề. Ngôn ngữ không đổi được."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="topic-name">Tên chủ đề</Label>
            <Input
              id="topic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="IELTS, Công việc, Du lịch…"
              maxLength={60}
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Màu nhãn</Label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setColor(null)}
                aria-label="Không chọn màu"
                aria-pressed={color === null}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs",
                  color === null
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
                  onClick={() => setColor(hex)}
                  aria-label={`Chọn màu ${hex}`}
                  aria-pressed={color === hex}
                  style={{ backgroundColor: hex }}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-transform",
                    color === hex
                      ? "scale-110 border-[var(--foreground)]"
                      : "border-transparent",
                  )}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Tạo chủ đề" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
