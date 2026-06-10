// Response-layer mapping: DB rows -> exact contract camelCase shapes.
import type {
  User as PrismaUser,
  Topic as PrismaTopic,
  Flashcard as PrismaFlashcard,
  ReadingExercise as PrismaReadingExercise,
  ReadingQuestion as PrismaReadingQuestion,
  ReadingAttempt as PrismaReadingAttempt,
  VocabularyEntry as PrismaVocabularyEntry,
} from "@prisma/client";

const iso = (d: Date): string => d.toISOString();

export function toUser(u: PrismaUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
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
    isFavorite: v.isFavorite,
    known: v.known,
    createdAt: iso(v.createdAt),
    updatedAt: iso(v.updatedAt),
  };
}
