/**
 * TypeScript types mirroring api-contract.md EXACTLY.
 * camelCase everywhere. List endpoints use the { items, total } wrapper.
 * Do not diverge from the contract without broadcasting a diff.
 */

// ---- Shared objects ----

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string; // ISO 8601
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface MeResponse {
  user: User;
}

export interface TopicSummary {
  id: string;
  slug: string;
  title: string;
  titleVi: string;
  description: string | null;
  flashcardCount: number;
  knownCount: number;
  completionPercent: number; // integer 0-100
  // v4 — Feature 7. null = seeded (read-only); non-null = owned by that user.
  userId: string | null;
}

export interface Flashcard {
  id: string;
  topicId: string;
  front: string;
  back: string;
  example: string | null;
  order: number;
  known: boolean; // per-authed-user
}

export interface TopicDetail extends TopicSummary {
  flashcards: Flashcard[]; // bare array INSIDE the object (not a list wrapper)
}

export interface ReadingQuestionPublic {
  id: string;
  prompt: string;
  options: string[];
  order: number;
  // NO correctIndex on the public/detail shape.
}

export interface ReadingQuestionGraded extends ReadingQuestionPublic {
  correctIndex: number;
  selectedIndex: number;
  correct: boolean;
}

export interface ReadingExerciseSummary {
  id: string;
  slug: string;
  title: string;
  level: string;
  questionCount: number;
  bestScore: number | null; // null if never attempted
}

export interface ReadingExerciseDetail {
  id: string;
  slug: string;
  title: string;
  level: string;
  passage: string;
  questions: ReadingQuestionPublic[]; // no correctIndex
}

export interface ReadingAttempt {
  id: string;
  exerciseId: string;
  score: number;
  total: number;
  createdAt: string;
}

export interface ReadingAttemptResult {
  id: string;
  exerciseId: string;
  score: number;
  total: number;
  createdAt: string;
  questions: ReadingQuestionGraded[];
}

// recentAttempts.items extend ReadingAttempt with slug + title for linking.
export interface RecentAttempt extends ReadingAttempt {
  exerciseSlug: string;
  exerciseTitle: string;
}

// ---- My Vocabulary (v2) ----

/** CEFR levels accepted by the contract for `cefrLevel`. */
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/**
 * VocabularyEntry — mirrors api-contract.md exactly.
 * Optional scalar fields are `string | null` (null when unset); array fields
 * (`synonyms`, `antonyms`, `tags`) are ALWAYS present (default []), never null.
 */
export interface VocabularyEntry {
  id: string;
  userId: string;
  word: string;
  meaning: string;
  pronunciation: string | null;
  partOfSpeech: string | null;
  synonyms: string[];
  antonyms: string[];
  exampleSentence: string | null;
  notes: string | null;
  tags: string[];
  cefrLevel: string | null; // one of CefrLevel or null
  isFavorite: boolean;
  known: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Editable body for POST / PUT /api/vocabulary[/:id] (word & meaning required). */
export interface VocabularyInput {
  word: string;
  meaning: string;
  pronunciation?: string;
  partOfSpeech?: string;
  synonyms?: string[];
  antonyms?: string[];
  exampleSentence?: string;
  notes?: string;
  tags?: string[];
  cefrLevel?: CefrLevel;
}

/** Query params for GET /api/vocabulary (all optional). */
export interface VocabularyListParams {
  search?: string;
  tag?: string;
  partOfSpeech?: string;
  favorite?: "true" | "false";
  sort?: "newest" | "oldest" | "az";
}

/** PUT /api/vocabulary/:id/favorite → minimal shape. */
export interface VocabularyFavoriteResponse {
  id: string;
  isFavorite: boolean;
}

/** PUT /api/vocabulary/:id/progress → minimal shape. */
export interface VocabularyProgressResponse {
  id: string;
  known: boolean;
}

/** DELETE /api/vocabulary/:id → { success: true }. */
export interface DeleteResponse {
  success: boolean;
}

// ---- List wrapper ----

export interface ListResponse<T> {
  items: T[];
  total: number;
}

// ---- Mutation responses ----

export interface FlashcardProgressResponse {
  flashcardId: string;
  known: boolean;
  updatedAt: string;
  nextReviewAt?: string | null; // v3 — SRS scheduler. Additive (omitted by old backends).
}

// v3 — GET /api/topics/:slug/review (list wrapper + dueCount alias)
export interface TopicReviewResponse {
  items: Flashcard[];
  total: number;
  dueCount: number;
}

// v3 — GET /api/dashboard/progress-history item
export interface ProgressHistoryItem {
  date: string; // YYYY-MM-DD (UTC calendar date)
  count: number;
}

export interface TopicResetResponse {
  slug: string;
  resetCount: number;
  knownCount: number;
  completionPercent: number;
}

// ---- Dashboard ----

export interface DashboardTotals {
  topicCount: number;
  flashcardCount: number;
  knownCount: number;
  overallCompletionPercent: number;
  readingAttemptCount: number;
}

export interface DashboardResponse {
  totals: DashboardTotals;
  topicProgress: ListResponse<TopicSummary>;
  recentAttempts: ListResponse<RecentAttempt>;
}

// ---- Error shape ----

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
  };
}
