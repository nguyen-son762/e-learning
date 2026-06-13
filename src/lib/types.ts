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
  vocabularyTopicId: string | null; // v8 — FK → VocabularyTopic.id (owned by same user, same language); null = untagged.
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
 * v8 — `vocabularyTopicId` is optional; explicit `null` clears the tag on PUT and
 * is equivalent to omission on POST. Non-null MUST reference a topic owned by the
 * caller in the same language; cross-language assignment is rejected at write time.
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
  vocabularyTopicId?: string | null; // v8 — optional; null clears the tag (PUT) or stays untagged (POST).
}

/** Query params for GET /api/vocabulary (all optional). */
export interface VocabularyListParams {
  search?: string;
  tag?: string;
  partOfSpeech?: string;
  favorite?: "true" | "false";
  sort?: "newest" | "oldest" | "az";
  language?: Language; // v6 — optional override; defaults to user.language
  /**
   * v8 — filter by topic id. Special sentinel `"__none__"` selects untagged
   * entries (`vocabularyTopicId IS NULL`). Unknown id → empty result (no error).
   */
  vocabularyTopicId?: string;
}

/** v8 — sentinel value the GET /api/vocabulary filter accepts for "untagged". */
export const VOCABULARY_TOPIC_NONE = "__none__";

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

// ---- v8 — Personal Vocabulary Topics ----

/**
 * VocabularyTopic — per-user, per-language label users attach to vocab entries.
 * Distinct from `TopicSummary`/`TopicDetail` (the v4 flashcard bucket) and from
 * `VocabularyEntry.tags[]` (free-text labels). Uniqueness is `(userId, language, name)`.
 */
export interface VocabularyTopic {
  id: string;
  userId: string;
  name: string;
  color: string | null; // hex `#RRGGBB`; null → frontend renders a default chip color.
  language: Language;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/vocabulary-topics body. `language` optional → inherits user.language. */
export interface VocabularyTopicCreateInput {
  name: string;
  color?: string | null;
  language?: Language;
}

/**
 * PATCH /api/vocabulary-topics/:id body — patch semantics; only provided fields update.
 * `language` is immutable after create and MUST NOT be sent.
 */
export interface VocabularyTopicPatchInput {
  name?: string;
  color?: string | null;
}

/** POST and PATCH responses wrap the topic in `{ item }`. */
export interface VocabularyTopicItemResponse {
  item: VocabularyTopic;
}

/** DELETE /api/vocabulary-topics/:id → { id } (matches v2/v4 delete precedent). */
export interface VocabularyTopicDeleteResponse {
  id: string;
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

export interface MineVocabularyInput extends Omit<VocabularyInput, "language"> {
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
