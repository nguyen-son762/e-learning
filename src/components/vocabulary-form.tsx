"use client";

import { useState } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  CefrLevel,
  HskLevel,
  Language,
  VocabularyEntry,
  VocabularyInput,
  VocabularyTopic,
} from "@/lib/types";
import { HSK_LEVELS } from "@/lib/types";
import { lookupWord, DictionaryNotFoundError } from "@/lib/dictionary";
import { Badge } from "@/components/ui/badge";
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
import { VocabularyTopicDialog } from "@/components/vocabulary-topic-dialog";

const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Sentinel for "no CEFR/HSK level" — Radix Select disallows an empty-string value. */
const CEFR_NONE = "none";
const HSK_NONE = "none_hsk";

const POS_NONE = "none_pos";
/** v8 — sentinel for "no vocabulary topic" (Radix Select disallows empty value). */
const TOPIC_NONE = "none_topic";
export const PARTS_OF_SPEECH: { value: string; label: string }[] = [
  { value: "noun", label: "noun — danh từ" },
  { value: "verb", label: "verb — động từ" },
  { value: "adjective", label: "adjective — tính từ" },
  { value: "adverb", label: "adverb — trạng từ" },
  { value: "pronoun", label: "pronoun — đại từ" },
  { value: "preposition", label: "preposition — giới từ" },
  { value: "conjunction", label: "conjunction — liên từ" },
  { value: "interjection", label: "interjection — thán từ" },
  { value: "phrase", label: "phrase — cụm từ" },
];

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
  cefrLevel: string; // "" = none. Only meaningful when language === "en".
  pinyin: string; // v6 — only meaningful when language === "zh".
  hskLevel: string; // v6 — "" or "1".."6". Only meaningful when language === "zh".
  vocabularyTopicId: string; // v8 — "" = untagged; non-empty = topic id.
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
    pinyin: "",
    hskLevel: "",
    vocabularyTopicId: "",
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
    pinyin: entry.pinyin ?? "",
    hskLevel: entry.hskLevel != null ? String(entry.hskLevel) : "",
    vocabularyTopicId: entry.vocabularyTopicId ?? "",
  };
}

/**
 * Convert form state → contract-shaped request body (omit empty optionals).
 * v6 — `language` decides whether cefrLevel or pinyin/hskLevel are sent. The
 * contract REJECTS mixing (e.g. cefrLevel on a zh entry), so we are strict here.
 */
function toInput(s: VocabularyFormState, language: Language): VocabularyInput {
  const input: VocabularyInput = {
    word: s.word.trim(),
    meaning: s.meaning.trim(),
    language,
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
  if (language === "en") {
    if (s.cefrLevel) input.cefrLevel = s.cefrLevel as CefrLevel;
  } else {
    if (s.pinyin.trim()) input.pinyin = s.pinyin.trim();
    if (s.hskLevel) input.hskLevel = Number(s.hskLevel) as HskLevel;
  }
  // v8 — always send vocabularyTopicId so PUT can clear the tag with explicit
  // null. On POST, explicit null is equivalent to omission per the contract.
  input.vocabularyTopicId = s.vocabularyTopicId || null;
  return input;
}

export function VocabularyForm({
  initial,
  language,
  submitLabel,
  onSubmit,
  showDictionary = false,
  topics,
  onTopicCreated,
}: {
  initial?: VocabularyFormState;
  /**
   * v6 — language of this entry. For new entries pass `user.language`; for
   * edits pass `entry.language` (immutable). Controls which level field shows
   * (CEFR vs HSK) and whether the pinyin input + dictionary button render.
   */
  language: Language;
  submitLabel: string;
  /** Persist; resolves on success, throws ApiError on failure. */
  onSubmit: (input: VocabularyInput) => Promise<void>;
  /** Show the "Tự điền từ điển" auto-fill button (client-only, en only). */
  showDictionary?: boolean;
  /**
   * v8 — topics for the "Chủ đề từ vựng" select. List MUST be pre-filtered to
   * `language` (the form does not filter); for /vocabulary/new pass topics for
   * `user.language`, for /vocabulary/[id]/edit pass topics for `entry.language`.
   */
  topics?: VocabularyTopic[];
  /**
   * v8 — called after the inline "+ Tạo chủ đề mới" dialog creates a topic, so
   * the parent can prepend it to its local cache. The form auto-selects it.
   */
  onTopicCreated?: (topic: VocabularyTopic) => void;
}) {
  const [form, setForm] = useState<VocabularyFormState>(
    initial ?? emptyState(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // v8 — inline topic-create dialog state.
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);

  const isZh = language === "zh";
  // Dictionary auto-fill is English-only (api.dictionaryapi.dev is en).
  const dictionaryAvailable = showDictionary && language === "en";

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
      setError("Vui lòng nhập cả từ và nghĩa.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(toInput(form, language));
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
      {/* v6 — language indicator on top of the form. */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-xs">
          {isZh ? "🇨🇳 Tiếng Trung" : "🇬🇧 Tiếng Anh"}
        </Badge>
        <span className="text-xs text-[var(--muted-foreground)]">
          Ngôn ngữ của từ này không thể đổi.
        </span>
      </div>

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
            {isZh ? "Từ (Hán tự)" : "Từ (English)"}{" "}
            <span className="text-[var(--destructive)]">*</span>
          </Label>
          {dictionaryAvailable && (
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
          placeholder={isZh ? "你好" : "ubiquitous"}
          required
          lang={isZh ? "zh-CN" : "en"}
          className={isZh ? "font-cjk text-lg" : undefined}
        />
      </div>

      {isZh && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="pinyin">Pinyin (có dấu thanh)</Label>
          <Input
            id="pinyin"
            value={form.pinyin}
            onChange={(e) => set("pinyin", e.target.value)}
            placeholder="nǐ hǎo"
            lang="zh-Latn-pinyin"
          />
        </div>
      )}

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

      {/* v8 — Vocabulary topic select (per-language). Hidden if the parent
          didn't pass topics (back-compat); otherwise always renders. */}
      {topics !== undefined && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="vocabularyTopicId">Chủ đề từ vựng</Label>
          <Select
            value={form.vocabularyTopicId || TOPIC_NONE}
            onValueChange={(v) =>
              set("vocabularyTopicId", v === TOPIC_NONE ? "" : v)
            }
          >
            <SelectTrigger id="vocabularyTopicId" aria-label="Chủ đề từ vựng">
              <SelectValue placeholder="Chưa gắn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOPIC_NONE}>Chưa gắn</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="inline-flex items-center gap-2">
                    {t.color && (
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                    )}
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setTopicDialogOpen(true)}
            className={cn(
              "h-auto self-start p-0 text-sm text-[var(--primary)]",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Tạo chủ đề mới
          </Button>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pronunciation">
            {isZh ? "Phiên âm bổ sung" : "Phiên âm (IPA)"}
          </Label>
          <Input
            id="pronunciation"
            value={form.pronunciation}
            onChange={(e) => set("pronunciation", e.target.value)}
            placeholder={isZh ? "" : "/juːˈbɪkwɪtəs/"}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="partOfSpeech">Loại từ</Label>
          <Select
            value={form.partOfSpeech || POS_NONE}
            onValueChange={(v) =>
              set("partOfSpeech", v === POS_NONE ? "" : v)
            }
          >
            <SelectTrigger id="partOfSpeech" aria-label="Loại từ">
              <SelectValue placeholder="— Không chọn —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={POS_NONE}>— Không chọn —</SelectItem>
              {PARTS_OF_SPEECH.map((pos) => (
                <SelectItem key={pos.value} value={pos.value}>
                  {pos.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {isZh ? (
            <>
              <Label htmlFor="hskLevel">Cấp độ HSK</Label>
              <Select
                value={form.hskLevel || HSK_NONE}
                onValueChange={(v) =>
                  set("hskLevel", v === HSK_NONE ? "" : v)
                }
              >
                <SelectTrigger id="hskLevel" aria-label="Cấp độ HSK">
                  <SelectValue placeholder="— Không chọn —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HSK_NONE}>— Không chọn —</SelectItem>
                  {HSK_LEVELS.map((lvl) => (
                    <SelectItem key={lvl} value={String(lvl)}>
                      HSK {lvl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>

      {/* v8 — inline "+ Tạo chủ đề mới" dialog. Topics are language-locked to
          the form's `language` prop (entry.language on edit; user.language on new). */}
      <VocabularyTopicDialog
        open={topicDialogOpen}
        mode="create"
        language={language}
        onSuccess={(t) => {
          setTopicDialogOpen(false);
          set("vocabularyTopicId", t.id);
          onTopicCreated?.(t);
        }}
        onClose={() => setTopicDialogOpen(false)}
      />
    </form>
  );
}
