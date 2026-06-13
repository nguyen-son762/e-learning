// Response-layer mapping: DB rows -> exact contract camelCase shapes.
import type {
  User as PrismaUser,
  Topic as PrismaTopic,
  Flashcard as PrismaFlashcard,
  ReadingExercise as PrismaReadingExercise,
  ReadingQuestion as PrismaReadingQuestion,
  ReadingAttempt as PrismaReadingAttempt,
  VocabularyEntry as PrismaVocabularyEntry,
  VocabularyTopic as PrismaVocabularyTopic,
  EarnedBadge as PrismaEarnedBadge,
} from "@prisma/client";
import { toBadge } from "./gamification";

const iso = (d: Date): string => d.toISOString();

type Language = "en" | "zh";

function asLanguageOrNull(v: string | null): Language | null {
  return v === "en" || v === "zh" ? v : null;
}

function asLanguage(v: string): Language {
  return v === "zh" ? "zh" : "en";
}

// v7 — User response includes streak/lastStudiedAt/totalXP/badges. `badges` is always an array
// (empty if none earned). Caller passes earned badge rows so this serializer stays sync/pure.
export function toUser(u: PrismaUser, earnedBadges: PrismaEarnedBadge[] = []) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as "USER" | "ADMIN",
    language: asLanguageOrNull(u.language),
    streak: u.streak,
    lastStudiedAt: u.lastStudiedAt ? iso(u.lastStudiedAt) : null,
    totalXP: u.totalXP,
    badges: earnedBadges.map(toBadge),
    createdAt: iso(u.createdAt),
  };
}

export function completionPercent(knownCount: number, flashcardCount: number): number {
  if (flashcardCount === 0) return 0;
  return Math.round((knownCount / flashcardCount) * 100);
}

export function toTopicSummary(
  t: PrismaTopic,
  flashcardCount: number,
  knownCount: number
) {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    titleVi: t.titleVi,
    description: t.description,
    flashcardCount,
    knownCount,
    completionPercent: completionPercent(knownCount, flashcardCount),
    userId: t.userId ?? null,
    language: asLanguage(t.language),
  };
}

export function toFlashcard(f: PrismaFlashcard, known: boolean) {
  return {
    id: f.id,
    topicId: f.topicId,
    front: f.front,
    back: f.back,
    example: f.example,
    order: f.order,
    known,
  };
}

export function toReadingExerciseSummary(
  e: PrismaReadingExercise,
  questionCount: number,
  bestScore: number | null
) {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    level: e.level,
    questionCount,
    bestScore,
    language: asLanguage(e.language),
    createdAt: iso(e.createdAt),
  };
}

export function toReadingQuestionAdmin(q: PrismaReadingQuestion) {
  return {
    id: q.id,
    exerciseId: q.exerciseId,
    prompt: q.prompt,
    options: q.options,
    correctIndex: q.correctIndex,
    order: q.order,
    createdAt: iso(q.createdAt),
  };
}

// Public question shape: NO correctIndex.
export function toReadingQuestionPublic(q: PrismaReadingQuestion) {
  return {
    id: q.id,
    prompt: q.prompt,
    options: q.options,
    order: q.order,
  };
}

// Graded question shape: includes correctIndex/selectedIndex/correct.
export function toReadingQuestionGraded(
  q: PrismaReadingQuestion,
  selectedIndex: number
) {
  return {
    id: q.id,
    prompt: q.prompt,
    options: q.options,
    order: q.order,
    correctIndex: q.correctIndex,
    selectedIndex,
    correct: selectedIndex === q.correctIndex,
  };
}

export function toReadingAttempt(a: PrismaReadingAttempt) {
  return {
    id: a.id,
    exerciseId: a.exerciseId,
    score: a.score,
    total: a.total,
    createdAt: iso(a.createdAt),
  };
}

// v2 — VocabularyEntry. Optional scalars -> null; array fields always present (never null).
// v6 — pinyin/hskLevel meaningful only when language === "zh"; cefrLevel only when language === "en".
export function toVocabularyEntry(v: PrismaVocabularyEntry) {
  return {
    id: v.id,
    userId: v.userId,
    word: v.word,
    meaning: v.meaning,
    pronunciation: v.pronunciation ?? null,
    partOfSpeech: v.partOfSpeech ?? null,
    synonyms: v.synonyms ?? [],
    antonyms: v.antonyms ?? [],
    exampleSentence: v.exampleSentence ?? null,
    notes: v.notes ?? null,
    tags: v.tags ?? [],
    cefrLevel: v.cefrLevel ?? null,
    pinyin: v.pinyin ?? null,
    hskLevel: v.hskLevel ?? null,
    language: asLanguage(v.language),
    isFavorite: v.isFavorite,
    known: v.known,
    // v8 — nullable FK to a per-user VocabularyTopic in the same language. Null = untagged.
    vocabularyTopicId: v.vocabularyTopicId ?? null,
    createdAt: iso(v.createdAt),
    updatedAt: iso(v.updatedAt),
  };
}

// v8 — VocabularyTopic response shape. color: null when unset; language: "en"|"zh".
export function toVocabularyTopic(t: PrismaVocabularyTopic) {
  return {
    id: t.id,
    userId: t.userId,
    name: t.name,
    color: t.color ?? null,
    language: asLanguage(t.language),
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
  };
}
