"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Plus, Trash2, ChevronLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchJson } from "@/lib/api";
import type { ReadingExerciseDetail, ReadingQuestionAdmin, ListResponse } from "@/lib/types";

interface QuestionEdit {
  id?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  isNew?: boolean;
}

export default function AdminReadingEditPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("beginner");
  const [passage, setPassage] = useState("");
  const [questions, setQuestions] = useState<QuestionEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ex, qs] = await Promise.all([
        fetchJson<ReadingExerciseDetail>(`/api/reading-exercises/${slug}`),
        fetchJson<ListResponse<ReadingQuestionAdmin>>(`/api/reading-exercises/${slug}/questions`),
      ]);
      setTitle(ex.title);
      setLevel(ex.level);
      setPassage(ex.passage);
      setQuestions(
        qs.items.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      { prompt: "", options: ["", "", "", ""], correctIndex: 0, isNew: true },
    ]);
  }

  function updateQuestion(i: number, field: keyof QuestionEdit, value: string | number | string[]) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, [field]: value } : q)));
  }

  function updateOption(qi: number, oi: number, value: string) {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qi
          ? { ...q, options: q.options.map((o, oidx) => (oidx === oi ? value : o)) }
          : q
      )
    );
  }

  function handleDeleteQuestion(i: number) {
    const q = questions[i];
    if (q.id && !q.isNew) {
      setPendingDeleteIdx(i);
    } else {
      setQuestions((qs) => qs.filter((_, idx) => idx !== i));
    }
  }

  async function handleDeleteQuestionConfirm() {
    if (pendingDeleteIdx === null) return;
    const q = questions[pendingDeleteIdx];
    setDeletingQuestion(true);
    try {
      await fetchJson(`/api/reading-exercises/${slug}/questions/${q.id}`, { method: "DELETE" });
      setQuestions((qs) => qs.filter((_, idx) => idx !== pendingDeleteIdx));
      setPendingDeleteIdx(null);
    } finally {
      setDeletingQuestion(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await fetchJson(`/api/reading-exercises/${slug}`, {
        method: "PUT",
        body: { title, level, passage },
      });

      for (const q of questions) {
        if (q.isNew || !q.id) {
          await fetchJson(`/api/reading-exercises/${slug}/questions`, {
            method: "POST",
            body: { prompt: q.prompt, options: q.options, correctIndex: q.correctIndex },
          });
        } else {
          await fetchJson(`/api/reading-exercises/${slug}/questions/${q.id}`, {
            method: "PUT",
            body: { prompt: q.prompt, options: q.options, correctIndex: q.correctIndex },
          });
        }
      }

      router.push("/admin/reading");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message ?? "Có lỗi xảy ra khi lưu.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/reading">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Sửa bài đọc</h1>
      </div>

      <ConfirmDialog
        open={pendingDeleteIdx !== null}
        title="Xoá câu hỏi?"
        description="Câu hỏi này sẽ bị xoá vĩnh viễn."
        loading={deletingQuestion}
        onConfirm={handleDeleteQuestionConfirm}
        onCancel={() => setPendingDeleteIdx(null)}
      />

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Tiêu đề</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="level">Cấp độ</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger id="level"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="passage">Bài đọc</Label>
          <Textarea id="passage" value={passage} onChange={(e) => setPassage(e.target.value)} rows={8} />
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Câu hỏi ({questions.length})</h2>

          {questions.map((q, qi) => (
            <div key={q.id ?? qi} className="rounded-lg border border-[var(--border)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  Câu {qi + 1} {q.isNew && <span className="text-xs text-[var(--primary)]">(mới)</span>}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteQuestion(qi)}>
                  <Trash2 className="h-4 w-4 text-[var(--destructive)]" />
                </Button>
              </div>

              <div className="space-y-1">
                <Label>Câu hỏi</Label>
                <Input
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qi, "prompt", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Các lựa chọn (chọn đáp án đúng)</Label>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correctIndex === oi}
                      onChange={() => updateQuestion(qi, "correctIndex", oi)}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    <Input
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      placeholder={`Lựa chọn ${oi + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" className="w-full" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-2" />
            Thêm câu hỏi
          </Button>
        </div>

        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/reading">Huỷ</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
