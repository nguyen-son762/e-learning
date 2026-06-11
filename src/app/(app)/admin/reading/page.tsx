"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { fetchJson } from "@/lib/api";
import type { ReadingExerciseSummary, ListResponse } from "@/lib/types";

export default function AdminReadingPage() {
  const [exercises, setExercises] = useState<ReadingExerciseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJson<ListResponse<ReadingExerciseSummary>>("/api/reading-exercises");
      const sorted = [...res.items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setExercises(sorted);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDeleteConfirm() {
    if (!pendingSlug) return;
    setDeletingSlug(pendingSlug);
    try {
      await fetchJson(`/api/reading-exercises/${pendingSlug}`, { method: "DELETE" });
      setPendingSlug(null);
      await load();
    } finally {
      setDeletingSlug(null);
    }
  }

  const pendingExercise = exercises.find((e) => e.slug === pendingSlug);

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!pendingSlug}
        title="Xoá bài đọc?"
        description={pendingExercise ? `Bài đọc "${pendingExercise.title}" sẽ bị xoá vĩnh viễn cùng toàn bộ câu hỏi.` : undefined}
        loading={!!deletingSlug}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingSlug(null)}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý bài đọc</h1>
        <Button asChild>
          <Link href="/admin/reading/new">
            <Plus className="h-4 w-4" />
            Tạo bài đọc mới
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : exercises.length === 0 ? (
        <p className="text-center text-[var(--muted-foreground)] py-12">Chưa có bài đọc nào.</p>
      ) : (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--secondary)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Tiêu đề</th>
                <th className="px-4 py-3 text-left font-medium">Cấp độ</th>
                <th className="px-4 py-3 text-left font-medium">Câu hỏi</th>
                <th className="px-4 py-3 text-left font-medium">Ngày tạo</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {exercises.map((ex) => (
                <tr key={ex.id} className="hover:bg-[var(--secondary)]/50">
                  <td className="px-4 py-3 font-medium">{ex.title}</td>
                  <td className="px-4 py-3 capitalize">{ex.level}</td>
                  <td className="px-4 py-3">{ex.questionCount}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {new Date(ex.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/reading/${ex.slug}/edit`}>
                          <Pencil className="h-3 w-3 mr-1" />
                          Sửa
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setPendingSlug(ex.slug)}
                        disabled={!!deletingSlug}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Xoá
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
