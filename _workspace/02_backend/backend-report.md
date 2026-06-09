# Backend Report — E-Learning API (Express + Postgres + Prisma)

Built against `_workspace/01_design/api-contract.md` (single source of truth) and `data-model.md`.
All 12 contract endpoints implemented. Build verified: `npm install`, `npx prisma generate`, `tsc --noEmit` all pass with no errors.

## How to run locally

```bash
cd server
cp .env.example .env            # set DATABASE_URL (Postgres), JWT_SECRET, PORT, CORS_ORIGIN
npm install
npx prisma generate
npx prisma migrate deploy       # or: npx prisma migrate dev   (applies prisma/migrations)
npm run seed                    # seeds 4 topics, 3 reading exercises, demo user
npm run dev                     # tsx watch -> http://localhost:4000 (health: GET /health)
```

Build for prod: `npm run build` (→ `dist/`), then `npm start`.
Demo credentials after seed: `demo@example.com` / `secret123`.

## Conventions enforced (per contract)
- All JSON fields camelCase. DB columns are snake_case (`@map`/`@@map` in schema); mapping to camelCase happens in `src/lib/serializers.ts` and controllers.
- List endpoints return `{ items, total }` wrapper (never a bare array). For MVP `total === items.length` except `recentAttempts.total` (= lifetime attempt count) per contract.
- Uniform error shape `{ error: { code, message } }` with Vietnamese messages, via `src/middleware/errorHandler.ts` + `src/lib/errors.ts`.
- Auth via `Authorization: Bearer <jwt>`; missing/invalid → 401 `UNAUTHENTICATED` (`src/middleware/auth.ts`).
- `correctIndex` NEVER serialized on reading-exercise detail; returned only in submit-attempt grading response.

## Endpoints implemented (file:line of handler)

| Method & path | Auth | Handler | Response shape |
|---|---|---|---|
| POST /api/auth/register | no | `controllers/authController.ts:25` register | 201 `{ token, user{id,email,name,createdAt} }` |
| POST /api/auth/login | no | `controllers/authController.ts:43` login | 200 `{ token, user{...} }` |
| GET /api/auth/me | yes | `controllers/authController.ts:62` me | 200 `{ user{...} }` |
| GET /api/topics | yes | `controllers/topicController.ts:9` listTopics | 200 `{ items: TopicSummary[], total }` |
| GET /api/topics/:slug | yes | `controllers/topicController.ts:36` getTopic | 200 `TopicDetail` (single obj + `flashcards[]`) |
| PUT /api/flashcards/:id/progress | yes | `controllers/topicController.ts:85` updateFlashcardProgress | 200 `{ flashcardId, known, updatedAt }` |
| POST /api/topics/:slug/progress/reset | yes | `controllers/topicController.ts:112` resetTopicProgress | 200 `{ slug, resetCount, knownCount, completionPercent }` |
| GET /api/dashboard | yes | `controllers/dashboardController.ts:6` getDashboard | 200 `{ totals, topicProgress{items,total}, recentAttempts{items,total} }` |
| GET /api/reading-exercises | yes | `controllers/readingController.ts:15` listExercises | 200 `{ items: ReadingExerciseSummary[], total }` |
| GET /api/reading-exercises/:slug | yes | `controllers/readingController.ts:48` getExercise | 200 `ReadingExerciseDetail` (questions WITHOUT correctIndex) |
| POST /api/reading-exercises/:slug/attempts | yes | `controllers/readingController.ts:70` createAttempt | 201 `ReadingAttemptResult` (graded questions WITH correctIndex/selectedIndex/correct) |
| GET /api/reading-exercises/:slug/attempts | yes | `controllers/readingController.ts:135` listAttempts | 200 `{ items: ReadingAttempt[], total }` newest first |

## Models (prisma/schema.prisma)
User, Topic, Flashcard, FlashcardProgress (`@@unique([userId, flashcardId])`), ReadingExercise, ReadingQuestion (`options String[]`, `correctIndex`), ReadingAttempt (`answers Json`, immutable/append-only). All tables/columns snake_case via `@map`/`@@map`.

## Migration
`prisma/migrations/20260609000000_init/migration.sql` — generated from schema via `prisma migrate diff` (creates all 7 tables, unique indexes, FKs with onDelete cascade). `migration_lock.toml` present (postgresql).

## Key behaviors
- `completionPercent` = `flashcardCount==0 ? 0 : round(knownCount/flashcardCount*100)` (integer), centralized in `serializers.ts`.
- Flashcard progress: upsert on `(userId, flashcardId)`; topic reset = `updateMany known:true -> false` for the user's cards in that topic, returns count flipped.
- Attempt grading: validates `answers.length === questionCount`, each index in range or `-1` (unanswered = incorrect); grades against stored `correctIndex`; creates immutable attempt; echoes per-question grading.
- `bestScore` per user via `groupBy _max(score)`, `null` if no attempts.

## Validation (zod)
- register: email valid, password min 6, name 1–80.
- login: email valid, password present → wrong creds = 401 `INVALID_CREDENTIALS`.
- flashcard progress: `known: boolean` required.
- attempt: `answers: number[]`, each int `>= -1`; length + range checked in handler → 400 `VALIDATION_ERROR`.

## Deviations from contract
None. All shapes implemented exactly as declared.

### Notes / assumptions (not deviations)
- Contract says MVP lists have `total === items.length`; the one intentional exception is `dashboard.recentAttempts.total` which the contract explicitly defines as lifetime attempt count (items capped at 5). Implemented per that note.
- `ReadingExerciseSummary`/`Detail` use `level` as a free-form string (contract + data-model both treat it as a string label); seed uses `beginner`/`intermediate`.
- No `role` field (per data-model: every user is a learner; content is seeded). No async/202 flows (contract states none).

---

## My Vocabulary (v2) — 2026-06-09

Personal, owner-scoped vocabulary store. 8 endpoints, additive-only (no existing models/endpoints changed).

### Model
- `VocabularyEntry` added to `server/prisma/schema.prisma:127` — snake_case `@map` columns (`user_id`, `part_of_speech`, `example_sentence`, `cefr_level`, `is_favorite`, `created_at`, `updated_at`), `synonyms/antonyms/tags` as `String[]` (Postgres `text[]`), `isFavorite`/`known` default false. Indexes `@@index([userId, createdAt])` + `@@index([userId, word])`. FK → User onDelete Cascade.
- `User.vocabularyEntries VocabularyEntry[]` relation added (`schema.prisma:27`).

### Migration
- `server/prisma/migrations/20260609010000_add_vocabulary/migration.sql` — idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, FK guarded by `pg_constraint` check).
- Applied to Supabase via `npx prisma migrate deploy` (succeeded; `prisma migrate status` → up to date).
- Re-apply command: `cd server && npx prisma migrate deploy`.

### Files
- Controller: `server/src/controllers/vocabularyController.ts`
- Routes: `server/src/routes/vocabularyRoutes.ts` (registered in `server/src/app.ts:33` as `app.use("/api/vocabulary", ...)`)
- Serializer: `toVocabularyEntry` in `server/src/lib/serializers.ts` (optional scalars → null, arrays always present).
- Seed: 3 demo entries for demo@example.com (idempotent — only when user has 0 entries), `server/prisma/seed.ts`.

### Endpoints (exact response shapes)
| Method + path | Controller fn:line | Auth | Success shape |
|---------------|--------------------|------|---------------|
| `GET /api/vocabulary` | `listVocabulary` `vocabularyController.ts:44` | Bearer | `200 { items: VocabularyEntry[], total }` |
| `GET /api/vocabulary/tags` | `listTags` `vocabularyController.ts:80` | Bearer | `200 { items: string[], total }` |
| `POST /api/vocabulary` | `createVocabulary` `vocabularyController.ts:102` | Bearer | `201 VocabularyEntry` (unwrapped) |
| `GET /api/vocabulary/:id` | `getVocabulary` `vocabularyController.ts:129` | Bearer | `200 VocabularyEntry` |
| `PUT /api/vocabulary/:id` | `updateVocabulary` `vocabularyController.ts:136` | Bearer | `200 VocabularyEntry` |
| `DELETE /api/vocabulary/:id` | `deleteVocabulary` `vocabularyController.ts:164` | Bearer | `200 { success: true }` |
| `PUT /api/vocabulary/:id/favorite` | `setFavorite` `vocabularyController.ts:172` | Bearer | `200 { id, isFavorite }` |
| `PUT /api/vocabulary/:id/progress` | `setProgress` `vocabularyController.ts:186` | Bearer | `200 { id, known }` |

### Behavior / contract fidelity
- Owner-scoped: every `:id` op loads via `getOwnedEntry` → entry missing OR owned by another user → `404 NOT_FOUND` (existence never leaked).
- Query filters (GET list): `search` (case-insensitive contains on word OR meaning), `tag` (`tags has`), `partOfSpeech` (exact), `favorite` ("true"/"false"), `sort` (`newest` default desc / `oldest` asc / `az` word asc). Unknown/empty params ignored, AND-combined.
- Validation (zod, via `parseBody`): `word`/`meaning` trimmed min-length 1; `cefrLevel ∈ {A1,A2,B1,B2,C1,C2}`; `synonyms/antonyms/tags` arrays of strings default `[]`. favorite/progress are idempotent SET from body (not blind flip).
- POST forces `isFavorite=false`/`known=false` server-side (ignores in-body). PUT applies `isFavorite`/`known` only when present, else leaves unchanged; `id/userId/createdAt` immutable, `updatedAt` auto.
- Route order: `/tags` declared before `/:id` so it is not captured as an id.

### Verify
- `npm install && npx prisma generate && npx tsc --noEmit` → exit 0.
- `npx prisma migrate deploy` → applied; `npm run seed` → 3 demo entries inserted.

### Contract deviations
- None. All 8 endpoints match contract v2 shapes exactly.
