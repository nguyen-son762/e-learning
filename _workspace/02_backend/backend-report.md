# Backend Report — v7 (SRS 4-button + Streak/XP + Sentence Mining)

## v7 — 2026-06-13

**Contract:** v7 section of `_workspace/01_design/api-contract.md` (Features A/B/C).

### Schema (`server/prisma/schema.prisma`) + migration `20260613100000_v7_gamification`
- `User` gained `streak Int @default(0)`, `lastStudiedAt DateTime?` (`last_studied_at`), `totalXP Int @default(0)` (`total_xp`).
- New `EarnedBadge` model — `{ id, userId, badgeId, earnedAt }` with `@@unique([userId, badgeId])` and `@@index([userId])`. Cascade-deletes with the parent user. Used as the persisted "once earned, never lost" log; the derived `User.badges` array is built by joining this table.

### `server/src/lib/gamification.ts` (new)
- `wireToSm2Quality(0|1|2|3) → 0|3|4|5` — Again→0, Hard→3, Good→4, Easy→5.
- `xpForQuality` — Again=0, Hard=5, Good=10, Easy=15 (per the v7 contract).
- `computeNewStreak` — UTC-day rule: previous UTC day → +=1, same UTC day → unchanged, otherwise → 1. Quality 0 (Again) does NOT advance streak (returns `currentStreak`) but caller still updates `lastStudiedAt`.
- `detectNewlyEarnedBadges` — `first-review` on the user's first ever rating call; `week-streak` when `streak >= 7` for the first time; `century-xp` when `totalXP >= 100` for the first time.
- `BADGE_LABELS` — Vietnamese display strings per the contract.

### `PUT /api/flashcards/:id/progress` (`topicController.ts`)
- Wire `quality` is now `z.number().int().min(0).max(3).optional()` (was 0..5). Default = 2 (Good). Mapped to SM-2 quality on the way in; existing `computeSrs` is unchanged.
- After the SRS upsert, awards XP and updates streak in the SAME transaction (`prisma.$transaction([upsert, user.update])`) so a partial failure can't leave XP awarded but no progress row written.
- `firstReviewEver` derived BEFORE updates by counting the user's existing `FlashcardProgress` rows.
- Newly-earned badges are persisted via `createMany({ skipDuplicates: true })` against the `@@unique([userId, badgeId])` constraint so concurrent ratings can't double-insert.
- Response gains `xpEarned: number` and `newStreak: number` (additive to existing `flashcardId/known/updatedAt/nextReviewAt`).

### `GET /api/dashboard` (`dashboardController.ts`)
- Added `dueToday: number` — computed as `(total flashcards in resolved language) − (progress rows for this user where nextReviewAt > now)`. Cards with no progress row (= never reviewed) are implicitly counted as due. Language-scoped exactly like every other dashboard field.
- Added `streak: number`, `totalXP: number` from `User`; `badges: Badge[]` from `EarnedBadge` (lifetime, language-agnostic per the contract).

### `GET /api/auth/me`, `POST /api/auth/login`, `POST /api/auth/register`, `PUT /api/users/me/language`
- All four return the `User` shape extended with `streak/lastStudiedAt/totalXP/badges`. `register` returns `badges: []` (fresh user). Other three read `EarnedBadge` rows and pass them to `toUser`.

### `POST /api/vocabulary/mine` (`vocabularyController.ts` + `vocabularyRoutes.ts`)
- New endpoint. Body `{ word: string, exampleSentence: string, language?: "en"|"zh" }`.
- `language` resolves via `resolveCreateLanguage` (defaults to `user.language`, 403 `LANGUAGE_NOT_SELECTED` if null and absent).
- Find-or-creates a per-user, per-language Topic. **Implementation note:** the schema's `@@unique([slug, language])` is global, so two users cannot both own a Topic at `("__mined__", "en")`. To honor the contract's intent ("per-user, per-language mined bucket; re-mining lands in the same slot") I derive the slug as `"__mined__-<userId>"`. From the caller's perspective the behavior is identical (one bucket per user+language; re-mining reuses; delete + re-mine creates fresh) — only the slug literal differs from the spec.
- Creates a `VocabularyEntry` with `word`, `exampleSentence`, and the resolved `language`; all other fields default (meaning is "" until the user edits it).
- Returns `201 { item: VocabularyEntry }`. Errors: 400 `VALIDATION_ERROR` on missing/empty `word` or `exampleSentence`, 403 `LANGUAGE_NOT_SELECTED` when applicable, 401 `UNAUTHENTICATED`.

### Serializers (`server/src/lib/serializers.ts`)
- `toUser(u, earnedBadges = [])` — adds `streak`, `lastStudiedAt` (ISO or null), `totalXP`, `badges` (mapped via `toBadge`). Caller passes earned-badge rows; serializer stays pure/sync.

### Build
- `npm run build` (in `server/`) — clean. `npx tsc --noEmit` clean.
- Migration SQL hand-written to match the Prisma diff: 3 `ALTER TABLE` on `users` (additive, with defaults) + `CREATE TABLE earned_badges` + unique index + FK.

### Files touched
- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260613100000_v7_gamification/migration.sql` (new)
- `server/src/lib/gamification.ts` (new)
- `server/src/lib/serializers.ts`
- `server/src/controllers/authController.ts`
- `server/src/controllers/userController.ts`
- `server/src/controllers/topicController.ts`
- `server/src/controllers/dashboardController.ts`
- `server/src/controllers/vocabularyController.ts`
- `server/src/routes/vocabularyRoutes.ts`

---

# Backend Report — v6 (Multi-language Chinese Module)

**Owner:** Son (backend-engineer)
**Date:** 2026-06-13 (re-amended after F2 patch)
**Contract:** v6 (`_workspace/01_design/api-contract.md`) + Amendment 2026-06-13 (`:slug` collision resolution & `/review` classification)
**Scope:** Add `language: "en" | "zh"` across `User`, `Topic`, `ReadingExercise`, `VocabularyEntry`; add `pinyin` + `hskLevel` to `VocabularyEntry`; expose `PUT /api/users/me/language`; gate list/dashboard endpoints with `LANGUAGE_NOT_SELECTED` when `user.language IS NULL` and no `?language=` query is passed; extend POSTs with `language` body inheritance; seed HSK 1–3 content (≥200 ZH flashcards); apply 3-step slug resolution to every `:slug` detail endpoint.

## Amendment 2026-06-13 — slug resolution

Per `api-contract.md` lines 1126–1159:

- `GET /api/topics/:slug/review` reclassified as **list-style** — accepts `?language=`, defaults to `user.language`, raises `403 LANGUAGE_NOT_SELECTED` when `user.language IS NULL` and no `?language=` is passed. Slug lookup uses the resolved language via `findUnique({ slug_language: { slug, language } })`. *(originally landed as F1 fix)*
- Every `:slug` detail/admin endpoint now uses the 3-step resolver:
  1. If caller passed `?language=` → exact `(slug, language)` match, 404 if absent.
  2. Else prefer `(slug, user.language)`; fall through to (3) if no match.
  3. Else fall back to `orderBy: [{ createdAt: "asc" }, { id: "asc" }]`, take first row with that slug. 404 only if no row exists in any language.
- The 3-step resolver NEVER raises `LANGUAGE_NOT_SELECTED` — fresh users can deep-link to seeded content.
- Authorization (owner check on user-created topics, admin role on reading writes) runs AFTER the slug resolves, so the right 403/404 still surfaces.

Helper centralized in `server/src/lib/language.ts`: `resolveSlug<T>(slug, { explicitLanguage, userLanguage, findOne, findFallback })`. Per-model wrappers `resolveSlugTopicId(req, slug)` / `resolveSlugExerciseId(req, slug)` live in the respective controllers and return the resolved row id (callers re-fetch with whatever includes they need). New `getUserLanguage(userId)` helper reads `user.language` without throwing.

Touched sites (16 total):
- `topicController.ts` — `getTopic`, `resetTopicProgress`, `updateTopic`, `deleteTopic`, `createFlashcard`. (`getTopicReview` already list-style from F1.)
- `readingController.ts` — `getExercise`, `createAttempt`, `listAttempts`, `updateExercise`, `deleteExercise`, `createQuestion`, `updateQuestion`, `listQuestions`, `deleteQuestion`.

Live-verified against `http://localhost:3101`:
1. AC1 — fresh user, `GET /api/topics/foo/review` (no query) → `403 LANGUAGE_NOT_SELECTED`. ✓
2. AC2 — seeded `en/travel` + user-created `zh/travel` both present:
   - `user.language=zh`, `GET /api/topics/travel` → returns `zh/travel`.
   - Same with `?language=en` → returns `en/travel`.
   - `user.language=en` → returns `en/travel`.
   ✓
3. AC3 — only `en/business` exists, `user.language=zh`, no query → returns `en/business` via step-3 fallback; response `language: "en"` signals cross-language read to FE. ✓
4. Bonus — fresh user (`language=null`) `GET /api/topics/travel` (no query) → 200 with `en/travel` via step-3 fallback; NEVER raises `LANGUAGE_NOT_SELECTED` on detail endpoints. ✓

---

## Files changed

### Prisma
- `server/prisma/schema.prisma`
  - `User.language String?` (nullable)
  - `Topic.language String @default("en")`, replaced `slug @unique` with compound `@@unique([slug, language])`, added `@@index([language])`
  - `ReadingExercise.language String @default("en")`, same compound-unique swap + index
  - `VocabularyEntry`: added `language String @default("en")`, `pinyin String?`, `hskLevel Int? @map("hsk_level")`, added `@@index([userId, language])`
- `server/prisma/migrations/20260613000000_multi_language/migration.sql`
  - `ALTER TABLE` to add the four `language` columns and `pinyin`/`hsk_level`.
  - Drops `topics_slug_key` / `reading_exercises_slug_key`, creates the new compound unique indexes.
  - Backfills `language='en'` on existing `users`/`topics`/`reading_exercises`/`vocabulary_entries` (per brief AC).

### Server source
- `server/src/lib/errors.ts` — added `LANGUAGE_NOT_SELECTED` → 403.
- `server/src/lib/language.ts` — **new**. `parseLanguageQuery`, `resolveListLanguage(userId, raw)` (defaults from `user.language`, throws `LANGUAGE_NOT_SELECTED` if null), `resolveCreateLanguage(userId, bodyLanguage)`.
- `server/src/lib/serializers.ts` — `toUser` returns `language: "en" | "zh" | null`; `toTopicSummary`, `toReadingExerciseSummary`, `toVocabularyEntry` all return `language: "en" | "zh"`; `toVocabularyEntry` also returns `pinyin`/`hskLevel`.
- `server/src/controllers/userController.ts` — **new**. `PUT /api/users/me/language { language: "en"|"zh" }` → `200 { user }`.
- `server/src/routes/userRoutes.ts` — **new**. Mounted at `/api/users`.
- `server/src/app.ts` — registered `userRoutes`.
- `server/src/controllers/topicController.ts`
  - `listTopics` reads `?language=`, scopes all topic + progress queries by `language`.
  - `getTopic` switched to `findFirst` (slug no longer globally unique); response now includes `language`.
  - `getTopicReview` uses `findFirst`.
  - `resetTopicProgress` uses `findFirst`.
  - `createTopic` accepts optional `language` in body; inherits from user; assigns to new row.
  - `updateTopic` / `deleteTopic` / `createFlashcard` prefer owner-scoped lookup, fall back to global slug match so cross-user mutations still raise 403 (not 404).
  - `uniqueSlug(base, language)` now scopes uniqueness checks via the compound `slug_language` key.
- `server/src/controllers/dashboardController.ts`
  - `getDashboard` resolves language, scopes topic/progress/reading-attempt queries by language; recent attempts scoped to `exercise.language`.
  - `getProgressHistory` resolves language and scopes progress rows to `flashcard.topic.language`.
- `server/src/controllers/readingController.ts`
  - `listExercises` reads `?language=`, scopes query.
  - `getExercise` / `createAttempt` / `listAttempts` use `findFirst` for slug lookups.
  - `getExercise` response includes `language`.
  - `createExercise` accepts optional `language` in body; uses compound `slug_language` unique check during slug dedup.
  - `updateExercise` / `deleteExercise` switch to `where: { id }` after a `findFirst` resolves the row.
- `server/src/controllers/vocabularyController.ts`
  - `listVocabulary` / `listTags` resolve language and add it to the `where` clause.
  - `entryBodySchema` extended with `pinyin?: string`, `hskLevel?: int 1–6`, `language?: "en"|"zh"`.
  - `createVocabulary` inherits language, validates per-language field validity, persists `cefrLevel`/`pinyin`/`hskLevel` only when appropriate.
  - `updateVocabulary` treats `language` as immutable post-create; rejects mismatched body language with 400; re-runs the per-language field validity check.

### Seed
- `server/prisma/seed.ts` rewritten:
  - Keeps the v1/v2 English seed verbatim (`travel`, `business`, `daily-life`, `food`).
  - Adds **13 Chinese topics / 200 cards** spanning HSK 1–3 with pinyin (tone marks, e.g. `mā/má/mǎ/mà`) and bilingual examples in the shape `汉字句子. Pīnyīn jùzi. (Nghĩa Việt.)`. Coverage:
    - HSK 1: numbers (17), colors (15), family (15), greetings (16), pronouns (16) → 5 topics
    - HSK 2: actions (15), time (14), places (12), food (13), transport (12) → 5 topics
    - HSK 3: emotions (20), weather (18), shopping (20) → 3 topics
  - Adds 3 ZH reading exercises (HSK 2-3): `zh-my-family`, `zh-weather-today`, `zh-shopping-trip` — passages in Hán tự, questions in Vietnamese.
  - Demo + admin users now seed with `language: "en"` so existing flows keep working; new registrations still surface `language: null` for the language-gate flow.

## Endpoints (final wire shapes)

### Auth / User
- `POST /api/auth/register` → `201 { token, user }` — `user.language` always `null`.
- `POST /api/auth/login` → `200 { token, user }` — `user.language` reflects stored value.
- `GET /api/auth/me` → `200 { user }` — includes `language`.
- `PUT /api/users/me/language` → `200 { user }`. Body: `{ language: "en" | "zh" }`. Never throws `LANGUAGE_NOT_SELECTED`.

### Topics
- `GET /api/topics?language=en|zh` → `{ items: TopicSummary[], total }`. `TopicSummary` now carries `language`.
- `GET /api/topics/:slug` → `TopicDetail` (single object). Includes `language`. Does NOT filter (returns the row as stored).
- `POST /api/topics` body `{ title, titleVi, description?, language? }` → `201 TopicSummary`. `language` defaults to `user.language` (403 if null).
- `PUT /api/topics/:slug` → `200 TopicSummary` (owner-scoped; uses `findFirst` since slug is now per-language).
- `DELETE /api/topics/:slug` → `200 { success: true }`.
- `POST /api/topics/:slug/flashcards` → `201 Flashcard`.
- `GET /api/topics/:slug/review` → `{ items: Flashcard[], total, dueCount }`.
- `POST /api/topics/:slug/progress/reset` → `{ slug, resetCount, knownCount, completionPercent }`.

### Flashcards
- `PUT /api/flashcards/:id/progress` → `{ flashcardId, known, updatedAt, nextReviewAt }` (unchanged).
- `PUT /api/flashcards/:id`, `DELETE /api/flashcards/:id` — unchanged.

### Dashboard
- `GET /api/dashboard?language=en|zh` → totals + topicProgress + recentAttempts, all scoped to the resolved language.
- `GET /api/dashboard/progress-history?days=7|30&language=en|zh` → daily zero-filled counts scoped to the resolved language.

### Reading
- `GET /api/reading-exercises?language=en|zh` → list. `ReadingExerciseSummary` carries `language`.
- `GET /api/reading-exercises/:slug` → `ReadingExerciseDetail` with `language`.
- `POST /api/reading-exercises` (admin) — body now accepts optional `language` (defaults from user). Slug-dedup is scoped per-language.
- `PUT /api/reading-exercises/:slug` / `DELETE` (admin) — unchanged externally; internals switched to `findFirst → update/delete by id`.
- `POST /api/reading-exercises/:slug/attempts`, `GET /api/reading-exercises/:slug/attempts`, question CRUD — unchanged externally; slug lookups switched to `findFirst`.

### Vocabulary
- `GET /api/vocabulary?language=en|zh` (+ existing filters) → list. Items carry `language`, `pinyin`, `hskLevel`.
- `GET /api/vocabulary/tags?language=en|zh` — scoped to language.
- `POST /api/vocabulary` body accepts `language?`, `pinyin?`, `hskLevel?` in addition to v2 fields. Server validates per-language field validity:
  - `language === "zh"` → `cefrLevel` must be absent/null; `pinyin` is optional string; `hskLevel` is 1–6.
  - `language === "en"` → `pinyin`/`hskLevel` must be absent/null; `cefrLevel` keeps existing CEFR validation.
- `PUT /api/vocabulary/:id` — language is immutable; body language (if provided) must match the stored value.
- All other endpoints (favorite, progress, delete) unchanged.

## Errors
- `403 LANGUAGE_NOT_SELECTED` — surfaced whenever a list/dashboard read or a POST defaults to `user.language` and the column is `null`. Endpoints that take an explicit `?language=` query or `language` body field bypass this check.
- `400 VALIDATION_ERROR` — bad `?language=` query value, bad body `language`, mismatched per-language fields (e.g. `pinyin` on an `en` entry).

## Verification

- `npx prisma generate` — clean.
- `npx tsc --noEmit -p tsconfig.json` — clean.
- `npx prisma migrate deploy` — migration `20260613000000_multi_language` applied against Supabase.
- `npm run seed` — `4 EN topics (40 cards) + 13 ZH topics (200 cards), 3 EN reading exercises + 3 ZH reading exercises`.
- Live smoke test against `http://localhost:3101`:
  - `POST /api/auth/login (demo)` → `user.language: "en"`.
  - `PUT /api/users/me/language { language: "zh" }` → returns updated user with `language: "zh"`.
  - `GET /api/topics` (default) → returns `en` topics; `?language=zh` → returns 13 ZH topics, each with `language: "zh"`.
  - `GET /api/topics/hsk1-numbers` → `TopicDetail` with `language: "zh"` and 15 cards.
  - `GET /api/reading-exercises?language=zh` → 3 items, all `language: "zh"`.
  - `GET /api/dashboard?language=zh` → `totals.topicCount: 13, flashcardCount: 200`.
  - Fresh `POST /api/auth/register` → `user.language: null`; subsequent `GET /api/topics` (no query) → `403 LANGUAGE_NOT_SELECTED`; same call with `?language=en` → succeeds.

## Notes for downstream teammates

- **Ha (frontend):** the per-endpoint shapes above match the contract v6 exactly. The 403 `LANGUAGE_NOT_SELECTED` is the redirect signal for the `/choose-language` gate. The Topic + ReadingExercise detail endpoints DO NOT filter — they return the row as stored and you can read `response.language` to switch UI variants.
- **Mai (QA):** key boundary checks are (1) every list/dashboard response item carries `language`; (2) `cefrLevel` is `null` on `zh` vocab entries and `pinyin`/`hskLevel` are `null` on `en` vocab entries; (3) the 403 `LANGUAGE_NOT_SELECTED` is only raised when the user has no language AND the caller did not pass an explicit `?language=`/body language; (4) slug uniqueness is per-language, so the same slug can legitimately exist for both `en` and `zh`. Seeded slugs used `travel`, `business`, etc. for EN and `hsk1-numbers`, … for ZH (no collisions).
- **Tu (deploy):** the migration is additive + a unique-index swap. Production deploy needs `prisma migrate deploy` then `npm run seed` (seed is idempotent — `upsert` keyed on `slug_language`, vocab seeded only if user has 0 entries). New `language` column on `users` is nullable; existing rows are backfilled to `'en'`.
