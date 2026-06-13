/**
 * TypeScript types mirroring api-contract.md EXACTLY.
 * camelCase everywhere. List endpoints use the { items, total } wrapper.
 * Do not diverge from the contract without broadcasting a diff.
 */

// ---- Shared objects ----

/**
 * v6 — Learning content language. Lowercase wire enum.
 * `null` on User only — means the user has never chosen → frontend redirects
 * to `/choose-language`. Other entities always carry a concrete value.
 */
export type Language = "en" | "zh";

/**
 * v7 — Gamification badge. Server-detected achievement, persisted on first
 * earn (once earned, never lost). `label` is a Vietnamese display string
 * frozen server-side — render as-is.
 */
export interface Badge {
  id: string; // "first-review" | "week-streak" | "century-xp"
  label: string;
  earnedAt: string; // ISO 8601
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN"; // v5
  language: Language | null; // v6 — null = never chosen → /choose-language
  createdAt: string; // ISO 8601
  streak: number; // v7 — consecutive-day study streak (>= 0)
  lastStudiedAt: string | null; // v7 — ISO 8601 of last SRS rating event
  totalXP: number; // v7 — lifetime XP (>= 0)
  badges: Badge[]; // v7 — earned badges (server-detected)
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
  language: Language; // v6
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
  createdAt: string; // v5
  language: Language; // v6
}

export interface ReadingQuestionAdmin {
  id: string;
  exerciseId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  order: number;
  createdAt: string;
}

export interface ReadingExerciseDetail {
  id: string;
  slug: string;
  title: string;
  level: string;
  passage: string;
  questions: ReadingQuestionPublic[]; // no correctIndex
  language: Language; // v6
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

/** CEFR levels accepted by the contract for `cefrLevel`. English only. */
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/** v6 — HSK levels for Chinese vocabulary (integers 1–6). */
export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6;
export const HSK_LEVELS: HskLevel[] = [1, 2, 3, 4, 5, 6];

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
  cefrLevel: string | null; // one of CefrLevel or null. v6: null when language === "zh"
  pinyin: string | null; // v6 — Hanyu Pinyin with tone marks. null when language === "en"
  hskLevel: number | null; // v6 — integer 1–6. null when language === "en"
  language: Language; // v6
  isFavorite: boolean;
  known: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Editable body for POST / PUT /api/vocabulary[/:id] (word & meaning required).
 * v6 — when `language === "zh"`, pinyin/hskLevel may be sent and cefrLevel must
 * be omitted; when `language === "en"`, cefrLevel may be sent and pinyin/hskLevel
 * must be omitted. `language` itself is optional on POST (inherits from user.language).
 */
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
  pinyin?: string; // v6
  hskLevel?: HskLevel; // v6
  language?: Language; // v6 — optional on POST; server inherits from user
}

/** Query params for GET /api/vocabulary (all optional). */
export interface VocabularyListParams {
  search?: string;
  tag?: string;
  partOfSpeech?: string;
  favorite?: "true" | "false";
  sort?: "newest" | "oldest" | "az";
  language?: Language; // v6 — optional override; defaults to user.language
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

// ---- v6 — Language preference endpoint ----

/** PUT /api/users/me/language → updated User wrapper. */
export interface LanguagePreferenceResponse {
  user: User;
}

/** Optional language filter shared by list endpoints. */
export interface LanguageScopedParams {
  language?: Language;
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
  xpEarned: number; // v7 — XP awarded by THIS rating (0|5|10|15)
  newStreak: number; // v7 — user's streak AFTER this rating
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
  // v7 — gamification (language-agnostic) + due CTA (language-scoped).
  streak: number;
  totalXP: number;
  dueToday: number;
  badges: Badge[];
}

// ---- v7 — Sentence Mining ----

export interface MineVocabularyInput {
  word: string;
  exampleSentence: string;
  language: Language; // REQUIRED — pass the reading screen's language explicitly
}

/** POST /api/vocabulary/mine → wrapped (differs from POST /api/vocabulary). */
export interface MineVocabularyResponse {
  item: VocabularyEntry;
}

// ---- Error shape ----

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
  };
}
