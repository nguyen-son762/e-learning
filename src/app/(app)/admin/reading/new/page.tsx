"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchJson } from "@/lib/api";

interface QuestionForm {
  prompt: string;
  options: string[];
  correctIndex: number;
}

const defaultQuestion = (): QuestionForm => ({
  prompt: "",
  options: ["", "", "", ""],
  correctIndex: 0,
});

export default function AdminReadingNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("beginner");
  const [passage, setPassage] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([defaultQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addQuestion() {
    setQuestions((q) => [...q, defaultQuestion()]);
  }

  function removeQuestion(i: number) {
    setQuestions((q) => q.filter((_, idx) => idx !== i));
  }

  function updateQuestion(i: number, field: keyof QuestionForm, value: string | number | string[]) {
    setQuestions((qs) =>
      qs.map((q, idx) => (idx === i ? { ...q, [field]: value } : q))
    );
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !passage.trim()) {
      setError("Tiêu đề và bài đọc không được để trống.");
      return;
    }
    for (const q of questions) {
      if (!q.prompt.trim() || q.options.some((o) => !o.trim())) {
        setError("Vui lòng điền đầy đủ câu hỏi và các lựa chọn.");
        return;
      }
    }
    setSubmitting(true);
    try {
      await fetchJson("/api/reading-exercises", {
        method: "POST",
        body: { title, level, passage, questions },
      });
      router.push("/admin/reading");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message ?? "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/reading">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Tạo bài đọc mới</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Tiêu đề</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="City Life"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="level">Cấp độ</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger id="level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="passage">Bài đọc</Label>
          <Textarea
            id="passage"
            value={passage}
            onChange={(e) => setPassage(e.target.value)}
            rows={8}
            placeholder="Nhập nội dung bài đọc..."
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Câu hỏi ({questions.length})</h2>
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="h-4 w-4 mr-1" />
              Thêm câu hỏi
            </Button>
          </div>

          {questions.map((q, qi) => (
            <div
              key={qi}
              className="rounded-lg border border-[var(--border)] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Câu {qi + 1}</span>
                {questions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(qi)}
                  >
                    <Trash2 className="h-4 w-4 text-[var(--destructive)]" />
                  </Button>
                )}
              </div>

              <div className="space-y-1">
                <Label>Câu hỏi</Label>
                <Input
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qi, "prompt", e.target.value)}
                  placeholder="What does the passage mainly discuss?"
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
        </div>

        {error && (
          <p className="text-sm text-[var(--destructive)]">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang tạo..." : "Tạo bài đọc"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/reading">Huỷ</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
