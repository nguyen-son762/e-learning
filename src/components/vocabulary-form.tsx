"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { CefrLevel, VocabularyEntry, VocabularyInput } from "@/lib/types";
import { lookupWord, DictionaryNotFoundError } from "@/lib/dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Sentinel for "no CEFR level" — Radix Select disallows an empty-string value. */
const CEFR_NONE = "none";

/** Parse a comma/newline separated string into a deduped, trimmed list. */
function parseList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const t = part.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

export interface VocabularyFormState {
  word: string;
  meaning: string;
  pronunciation: string;
  partOfSpeech: string;
  synonyms: string; // comma-separated in the input
  antonyms: string;
  exampleSentence: string;
  notes: string;
  tags: string;
  cefrLevel: string; // "" = none
}

function emptyState(): VocabularyFormState {
  return {
    word: "",
    meaning: "",
    pronunciation: "",
    partOfSpeech: "",
    synonyms: "",
    antonyms: "",
    exampleSentence: "",
    notes: "",
    tags: "",
    cefrLevel: "",
  };
}

/** Build initial form state from an existing entry (for edit). */
export function stateFromEntry(entry: VocabularyEntry): VocabularyFormState {
  return {
    word: entry.word,
    meaning: entry.meaning,
    pronunciation: entry.pronunciation ?? "",
    partOfSpeech: entry.partOfSpeech ?? "",
    synonyms: entry.synonyms.join(", "),
    antonyms: entry.antonyms.join(", "),
    exampleSentence: entry.exampleSentence ?? "",
    notes: entry.notes ?? "",
    tags: entry.tags.join(", "),
    cefrLevel: entry.cefrLevel ?? "",
  };
}

/** Convert form state → contract-shaped request body (omit empty optionals). */
function toInput(s: VocabularyFormState): VocabularyInput {
  const input: VocabularyInput = {
    word: s.word.trim(),
    meaning: s.meaning.trim(),
  };
  if (s.pronunciation.trim()) input.pronunciation = s.pronunciation.trim();
  if (s.partOfSpeech.trim()) input.partOfSpeech = s.partOfSpeech.trim();
  if (s.exampleSentence.trim()) input.exampleSentence = s.exampleSentence.trim();
  if (s.notes.trim()) input.notes = s.notes.trim();
  const synonyms = parseList(s.synonyms);
  if (synonyms.length) input.synonyms = synonyms;
  const antonyms = parseList(s.antonyms);
  if (antonyms.length) input.antonyms = antonyms;
  const tags = parseList(s.tags);
  if (tags.length) input.tags = tags;
  if (s.cefrLevel) input.cefrLevel = s.cefrLevel as CefrLevel;
  return input;
}

export function VocabularyForm({
  initial,
  submitLabel,
  onSubmit,
  showDictionary = false,
}: {
  initial?: VocabularyFormState;
  submitLabel: string;
  /** Persist; resolves on success, throws ApiError on failure. */
  onSubmit: (input: VocabularyInput) => Promise<void>;
  /** Show the "Tự điền từ điển" auto-fill button (client-only). */
  showDictionary?: boolean;
}) {
  const [form, setForm] = useState<VocabularyFormState>(
    initial ?? emptyState(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof VocabularyFormState>(
    key: K,
    value: VocabularyFormState[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.word.trim() || !form.meaning.trim()) {
      setError("Vui lòng nhập cả từ (word) và nghĩa (meaning).");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(toInput(form));
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Không lưu được. Vui lòng thử lại.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function autofill() {
    const word = form.word.trim();
    if (!word) {
      toast.error("Hãy nhập từ tiếng Anh trước khi tự điền.");
      return;
    }
    setLooking(true);
    try {
      const fill = await lookupWord(word);
      setForm((f) => ({
        ...f,
        pronunciation: fill.pronunciation ?? f.pronunciation,
        partOfSpeech: fill.partOfSpeech ?? f.partOfSpeech,
        // Only fill meaning if user hasn't typed one (don't clobber Vietnamese).
        meaning: f.meaning.trim() ? f.meaning : (fill.meaning ?? f.meaning),
        exampleSentence: fill.exampleSentence ?? f.exampleSentence,
        synonyms: fill.synonyms.length
          ? fill.synonyms.join(", ")
          : f.synonyms,
        antonyms: fill.antonyms.length
          ? fill.antonyms.join(", ")
          : f.antonyms,
      }));
      toast.success("Đã điền gợi ý từ từ điển. Hãy kiểm tra và chỉnh lại.");
    } catch (err) {
      if (err instanceof DictionaryNotFoundError) {
        toast.error(err.message);
      } else {
        const msg = err instanceof Error ? err.message : "Tra từ điển thất bại.";
        toast.error(msg);
      }
    } finally {
      setLooking(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <Label htmlFor="word">
            Từ (English) <span className="text-[var(--destructive)]">*</span>
          </Label>
          {showDictionary && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={autofill}
              disabled={looking}
            >
              {looking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Tự điền từ điển
            </Button>
          )}
        </div>
        <Input
          id="word"
          value={form.word}
          onChange={(e) => set("word", e.target.value)}
          placeholder="ubiquitous"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="meaning">
          Nghĩa (Tiếng Việt){" "}
          <span className="text-[var(--destructive)]">*</span>
        </Label>
        <Input
          id="meaning"
          value={form.meaning}
          onChange={(e) => set("meaning", e.target.value)}
          placeholder="có mặt khắp nơi"
          required
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pronunciation">Phiên âm (IPA)</Label>
          <Input
            id="pronunciation"
            value={form.pronunciation}
            onChange={(e) => set("pronunciation", e.target.value)}
            placeholder="/juːˈbɪkwɪtəs/"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="partOfSpeech">Loại từ</Label>
          <Input
            id="partOfSpeech"
            value={form.partOfSpeech}
            onChange={(e) => set("partOfSpeech", e.target.value)}
            placeholder="adjective"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="synonyms">Từ đồng nghĩa</Label>
        <Input
          id="synonyms"
          value={form.synonyms}
          onChange={(e) => set("synonyms", e.target.value)}
          placeholder="omnipresent, pervasive (ngăn cách bằng dấu phẩy)"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="antonyms">Từ trái nghĩa</Label>
        <Input
          id="antonyms"
          value={form.antonyms}
          onChange={(e) => set("antonyms", e.target.value)}
          placeholder="rare (ngăn cách bằng dấu phẩy)"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="exampleSentence">Câu ví dụ</Label>
        <Textarea
          id="exampleSentence"
          value={form.exampleSentence}
          onChange={(e) => set("exampleSentence", e.target.value)}
          placeholder="Smartphones are ubiquitous nowadays."
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Ghi chú</Label>
        <Textarea
          id="notes"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="ôn lại tuần sau"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tags">Thẻ (tags)</Label>
          <Input
            id="tags"
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="IELTS, business (ngăn cách bằng dấu phẩy)"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cefrLevel">Cấp độ CEFR</Label>
          <Select
            value={form.cefrLevel || CEFR_NONE}
            onValueChange={(v) =>
              set("cefrLevel", v === CEFR_NONE ? "" : v)
            }
          >
            <SelectTrigger id="cefrLevel" aria-label="Cấp độ CEFR">
              <SelectValue placeholder="— Không chọn —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CEFR_NONE}>— Không chọn —</SelectItem>
              {CEFR_LEVELS.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>
                  {lvl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
