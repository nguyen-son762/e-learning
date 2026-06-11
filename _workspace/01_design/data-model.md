# Data Model — English Learning App (MVP)

> **v5 (2026-06-11): + Admin Reading Management.** Introduces a `Role` enum (`USER | ADMIN`) and a `role Role @default(USER)` column on `User`. Powers admin-only mutations on `ReadingExercise` and `ReadingQuestion` (CRUD). No other model changes; existing seeded `User` rows backfill to `USER`. See v5 DIFF at end.
>
> **v4 (2026-06-10): + User-created Topics & Flashcards (Feature 7).** `Topic` gains a nullable `userId` FK → `User.id` distinguishing seeded content (`userId IS NULL`, read-only) from user-created content (`userId` set, owner-writable). New index `@@index([userId])` on Topic. Cascade deletes (`Topic` → `Flashcard` → `FlashcardProgress`; `Flashcard` → `FlashcardProgress`) enforced server-side via transactional delete in the API layer; the Prisma relation MAY also use `onDelete: Cascade` to back it up. No changes to `Flashcard`, `FlashcardProgress`, or any other model. See v4 DIFF at end.
>
> **v3 (2026-06-10): + Spaced Repetition (SRS) on `FlashcardProgress`.** Added four SRS fields — `interval`, `easeFactor`, `nextReviewAt`, `repetitions` — driven by SM-2 on `PUT /api/flashcards/:id/progress`. Powers the new `GET /api/topics/:slug/review` due-queue endpoint. No schema changes for Feature 4 (progress chart is computed from existing `FlashcardProgress` rows) or Feature 8 (reading→vocabulary is client-only on top of existing `VocabularyEntry`). See v3 DIFF at end.
>
> **v2 (2026-06-09): + My Vocabulary feature** — added `VocabularyEntry` (User 1—n), snake_case `@map` columns, wire stays camelCase.

Prisma data model. Postgres. All DB column names use Prisma default mapping (camelCase in schema → snake_case where noted via `@map` is optional; for MVP we keep Prisma camelCase fields). **API JSON is always camelCase** (see `api-contract.md`).

> Convention note for backend: Prisma model fields below are camelCase. Postgres columns may be snake_case if you add `@@map`/`@map`, but the **API layer must serialize camelCase regardless**.

---

## Entities

### User
A learner account (or admin). Auth is email + password (bcrypt hash), JWT issued on login. As of v5, every user carries a `role` distinguishing regular learners (`USER`) from platform admins (`ADMIN`).

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| email | String | unique, lowercased |
| passwordHash | String | bcrypt; never serialized to API |
| name | String | display name |
| role | Role | *(v5)* `USER` (default) \| `ADMIN`; gates `/admin/*` routes and reading-content mutations |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |

Relations: `flashcardProgress[]`, `readingAttempts[]`, `vocabularyEntries[]`, `topics[]` *(v4 — user-created topics owned by this user)*.

#### Role enum *(v5)*

```prisma
enum Role {
  USER
  ADMIN
}
```

Prisma column: `role Role @default(USER)`. The JWT payload MAY embed `role` to short-circuit DB lookups on the admin middleware, but the authoritative source remains the `User.role` column — refetch on token refresh / role change.

> **Role semantics (v5):**
> - `USER` (default) — standard learner. Sees `/admin/*` as `404` (route not rendered) and any `/api/reading-exercises` content mutation returns `403 FORBIDDEN`.
> - `ADMIN` — platform admin. Authoring authority over reading content only (CRUD on `ReadingExercise` + `ReadingQuestion`). Admins are still subject to the v4 ownership rules for user-created topics/flashcards — they do **not** get bypass on other users' personal content. Promotion to `ADMIN` is out-of-band (seed script / DB update); no self-service endpoint in v5.
> - As of v4, users CAN still author their own topics + flashcards (Feature 7); seeded content (topics with `userId IS NULL`) remains read-only for everyone, ADMIN included — admin authority covers reading exercises, not seeded vocabulary topics. ASSUMPTION: an instructor role with cross-user vocabulary authoring is still out of scope.

---

### Topic
A vocabulary topic that groups flashcards (e.g. "Travel", "Business", "Food"). As of v4, topics are either **seeded** (`userId IS NULL`, read-only) or **user-created** (`userId` set, owner-writable).

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| slug | String | unique, URL-safe (e.g. `travel`); for user-created topics, auto-generated server-side from `title` with `-2,-3,…` dedup suffix |
| title | String | English display title (e.g. "Travel") |
| titleVi | String | Vietnamese label shown in UI (e.g. "Du lịch") |
| description | String? | optional short blurb (Vietnamese) |
| order | Int | sort order in lists, default 0 |
| userId | String? | *(v4)* nullable FK → `User.id`. **`null` = seeded content (read-only for all users)**; **non-null = user-created (only that user may edit/delete)**. Prisma relation may declare `onDelete: Cascade` so deleting a user removes their topics (and their cards / progress rows through the existing cascade). |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |

Relations: `flashcards[]`, `owner` (User?) *(v4 — null when seeded)*.

Indexes:
- `@@index([userId])` *(v4)* — powers "list this user's topics" filtering and the ownership check on every mutation (PUT/DELETE topic, POST/PUT/DELETE flashcard).

Derived (computed at query time, not stored): `flashcardCount`.

**Ownership semantics (v4) — enforced in the API layer on every mutation:**
- **Seeded topics (`userId === null`)**: read-only for ALL users. Any `POST /api/topics/:slug/flashcards`, `PUT /api/topics/:slug`, `DELETE /api/topics/:slug`, `PUT /api/flashcards/:id`, or `DELETE /api/flashcards/:id` against a seeded topic → `403 FORBIDDEN`. Read endpoints (`GET /api/topics`, `GET /api/topics/:slug`, dashboard) and per-user progress mutations (`PUT /api/flashcards/:id/progress`, `POST /api/topics/:slug/progress/reset`) still work normally — those are not content mutations.
- **User-created topics (`userId !== null`)**: writable by the owner only (`req.user.id === topic.userId`). Any cross-user mutation → `403 FORBIDDEN` (NOT 404 — we surface the permission boundary explicitly so the frontend can show a clear "không có quyền" message). Reads still work for any authed user, same as seeded content.
- **Flashcards inherit ownership from their parent `Topic`** — there is no `Flashcard.userId`. The check on `POST /api/topics/:slug/flashcards`, `PUT /api/flashcards/:id`, and `DELETE /api/flashcards/:id` is always against `flashcard.topic.userId`.

---

### Flashcard
A single vocabulary card belonging to a topic.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| topicId | String | FK → Topic.id |
| front | String | English word/phrase (card front) |
| back | String | Vietnamese meaning (card back) |
| example | String? | example sentence in English (card back) |
| order | Int | sort order within topic, default 0 |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |

Relations: `topic` (Topic), `progress[]` (FlashcardProgress).

---

### FlashcardProgress
Per-user, per-card learned state **and SRS scheduler state** *(v3)*. One row per (userId, flashcardId).

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK → User.id |
| flashcardId | String | FK → Flashcard.id |
| known | Boolean | true = "đã thuộc", false = "chưa thuộc"; default false |
| interval | Int | *(v3)* SRS review interval in days; default `1` |
| easeFactor | Float | *(v3)* SM-2 ease factor; default `2.5` |
| nextReviewAt | DateTime? | *(v3)* when this card is next due for review; **nullable** (null = never reviewed → always due) |
| repetitions | Int | *(v3)* number of successful review repetitions; default `0` |
| updatedAt | DateTime | @updatedAt — last time the user marked it |
| createdAt | DateTime | default now() |

Constraints: `@@unique([userId, flashcardId])`.
Indexes *(v3)*:
- `@@index([userId, nextReviewAt])` — powers `GET /api/topics/:slug/review` due-queue scan (filter by user, order by `nextReviewAt ASC NULLS FIRST`).

Semantics:
- A card with **no** progress row for a user = treated as `known: false` AND **always due** (`nextReviewAt` effectively null).
- "Mark thuộc/chưa thuộc" upserts this row.
- "Reset ôn lại" for a topic = set `known = false` for all the user's progress rows in that topic (rows kept, flag flipped). *(v3)* Reset also clears SRS state: `interval` → 1, `easeFactor` → 2.5, `repetitions` → 0, `nextReviewAt` → null, so re-studied cards re-enter the SRS queue from scratch.

SRS scheduler *(v3)* — SM-2 (simplified):
- Input: `quality ∈ [0,5]` from `PUT /api/flashcards/:id/progress` (default `3` if omitted).
- If `quality < 3`: `repetitions = 0`, `interval = 1`, `easeFactor` unchanged; `nextReviewAt = now + 1 day`.
- If `quality >= 3`:
  - `repetitions += 1`
  - `interval = (repetitions == 1) ? 1 : (repetitions == 2) ? 6 : round(interval * easeFactor)`
  - `easeFactor = max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))`
  - `nextReviewAt = now + interval days`
- The four SRS fields are **server-internal**; they are NOT serialized as part of the public `Flashcard` shape. Only `nextReviewAt` is echoed on the `PUT /api/flashcards/:id/progress` response so the client can show "next review in N days".

---

### ReadingExercise
A reading passage with a set of multiple-choice questions.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| slug | String | unique, URL-safe |
| title | String | exercise title (English) |
| passage | String (Text) | the reading passage (English, may be multi-paragraph) |
| level | String | difficulty label, e.g. `beginner` \| `intermediate` \| `advanced` |
| order | Int | sort order, default 0 |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |

Relations: `questions[]` (ReadingQuestion), `attempts[]` (ReadingAttempt).

Derived: `questionCount`.

---

### ReadingQuestion
A multiple-choice question for a reading exercise.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| exerciseId | String | FK → ReadingExercise.id |
| prompt | String | the question text (English) |
| options | String[] | array of answer choices (Postgres text[]); typically 4 |
| correctIndex | Int | index into `options` of the correct answer; **never serialized to client before submit** |
| order | Int | question order within exercise, default 0 |
| createdAt | DateTime | default now() |

Relations: `exercise` (ReadingExercise).

> Security: `correctIndex` is excluded from the exercise-detail response. It is only used server-side for grading and may be echoed back in the submit response (per-question correctness) so the UI can show review.

---

### ReadingAttempt
A graded submission of a reading exercise by a user.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK → User.id |
| exerciseId | String | FK → ReadingExercise.id |
| answers | Json | array of chosen indices, e.g. `[2,0,1,3]`, aligned to question order |
| score | Int | number of correct answers |
| total | Int | total questions at time of attempt |
| createdAt | DateTime | default now() — attempt timestamp |

Relations: `user` (User), `exercise` (ReadingExercise).

Semantics:
- Attempts are **append-only** (immutable). A user may attempt the same exercise multiple times; each creates a new row.
- `score`/`total` computed server-side at submit; client-provided scores are ignored.

---

### VocabularyEntry  *(v2 — My Vocabulary)*
A personal vocabulary item owned by a single user. Every entry is private to its owner; cross-user access returns `404 NOT_FOUND` (existence not leaked).

| Field | Type | DB `@map` | Notes |
|-------|------|-----------|-------|
| id | String (cuid) | `id` | PK |
| userId | String | `user_id` | FK → User.id (owner) |
| word | String | `word` | English word; **required, non-empty** |
| meaning | String | `meaning` | meaning (VN or EN); **required, non-empty** |
| pronunciation | String? | `pronunciation` | IPA, optional |
| partOfSpeech | String? | `part_of_speech` | noun/verb/adj/adv/…, optional |
| synonyms | String[] | `synonyms` | Postgres `text[]`, default `[]` |
| antonyms | String[] | `antonyms` | Postgres `text[]`, default `[]` |
| exampleSentence | String? | `example_sentence` | example sentence containing the word, optional |
| notes | String? | `notes` | personal notes, optional |
| tags | String[] | `tags` | Postgres `text[]`, default `[]`; user-defined topic groups |
| cefrLevel | String? | `cefr_level` | optional; if present must be one of `A1 A2 B1 B2 C1 C2` |
| isFavorite | Boolean | `is_favorite` | star flag; **default false** |
| known | Boolean | `known` | flashcard-study "thuộc" state; **default false** |
| createdAt | DateTime | `created_at` | default now() |
| updatedAt | DateTime | `updated_at` | @updatedAt |

Relations: `user` (User).

Indexes:
- `@@index([userId, createdAt])` — default list ordering (newest-first) scoped to owner.
- `@@index([userId, word])` — optional; speeds word lookup/search and de-dup checks within a user's set.

> Convention: model fields camelCase in Prisma schema, Postgres columns snake_case via `@map`/`@@map`. API serializes camelCase (see `api-contract.md`). `known` lives **directly on the entry** (not in a separate progress table) because a vocabulary entry already belongs to exactly one user — no per-user fan-out needed, unlike `Flashcard`/`FlashcardProgress`.

Validation (enforced at API layer):
- `word`, `meaning`: trimmed, length ≥ 1 → else `400 VALIDATION_ERROR`.
- `cefrLevel`: if provided, ∈ `{A1,A2,B1,B2,C1,C2}` → else `400 VALIDATION_ERROR`.
- `synonyms` / `antonyms` / `tags`: arrays of strings (omitted/null → treated as `[]`).

---

## Relationships (summary)

```
User 1───* FlashcardProgress *───1 Flashcard *───1 Topic *───0..1 User    (v4 — owner; 0 = seeded)
User 1───* ReadingAttempt    *───1 ReadingExercise 1───* ReadingQuestion
User 1───* VocabularyEntry                                  (v2)
```

- Topic 1—* Flashcard (a topic has many cards)
- Topic *—0..1 User *(v4 — `Topic.userId` is nullable; `null` = seeded, non-null = owner)*
- Flashcard 1—* FlashcardProgress (a card has progress rows, one per user)
- User 1—* FlashcardProgress (a user has progress across cards)
- User 1—* Topic *(v4 — user-created topics owned by this user)*
- ReadingExercise 1—* ReadingQuestion
- ReadingExercise 1—* ReadingAttempt
- User 1—* ReadingAttempt
- User 1—* VocabularyEntry (a user owns many private vocabulary entries) *(v2)*

---

## State / lifecycle notes (no complex state machines in MVP)

### Flashcard known-state (per user per card)
Two states, freely toggled:

```
(no row) ──mark known──▶ known:true
(no row) ──mark unknown─▶ known:false   (creates row)
known:true ──toggle────▶ known:false
known:false ──toggle───▶ known:true
known:true ──topic reset─▶ known:false
```

All transitions are allowed in both directions; there is no terminal state. Reset operates per-topic across all the user's cards in that topic.

### Flashcard SRS-state (per user per card) *(v3)*
Each `FlashcardProgress` row carries an SRS triple `(interval, easeFactor, repetitions)` and a scheduled `nextReviewAt`. The state machine is driven by the `quality ∈ [0,5]` parameter on `PUT /api/flashcards/:id/progress`:

```
(no row)          ──first review (any quality)──▶ new row, SRS triple seeded, nextReviewAt set
                                                  - quality<3: repetitions=0, interval=1
                                                  - quality>=3: repetitions=1, interval=1

learning (rep=1)  ──quality>=3──▶ reviewing (rep=2, interval=6)
                  ──quality<3 ──▶ learning (rep=0, interval=1, ease unchanged)

reviewing (rep>=2) ──quality>=3──▶ reviewing (rep+=1, interval=round(interval*ease), ease updated)
                   ──quality<3 ──▶ learning (rep=0, interval=1, ease unchanged)

any state ──topic reset──▶ (rep=0, interval=1, ease=2.5, nextReviewAt=null)
```

A card is **due** when `nextReviewAt IS NULL` OR `nextReviewAt <= now`. The `GET /api/topics/:slug/review` queue selects due cards ordered by `nextReviewAt ASC NULLS FIRST` (never-reviewed first, then most-overdue first). No terminal state — cards can re-enter "learning" from any quality<3 review.

### ReadingAttempt lifecycle
Single terminal action — there is no draft/in-progress persisted state in MVP:

```
(client in-memory answering) ──submit──▶ ReadingAttempt created (immutable, graded)
```

No edit/delete of attempts in MVP. Re-taking = a new attempt row.

### VocabularyEntry flags (per entry, owner-only) *(v2)*
Two independent boolean flags, freely toggled — no terminal state:

```
isFavorite:false ──toggle (PUT …/favorite)──▶ isFavorite:true ──toggle──▶ isFavorite:false
known:false      ──toggle (PUT …/progress)──▶ known:true      ──toggle──▶ known:false
```

`known` mirrors the `Flashcard` known-toggle pattern but is stored directly on the entry row (single owner). Full-field edit via `PUT /api/vocabulary/:id` may also change either flag.

---

## Derived / computed values (for dashboard & lists)

| Value | Definition |
|-------|-----------|
| topic.flashcardCount | count of Flashcard where topicId = topic.id |
| topic.knownCount (per user) | count of FlashcardProgress where userId = me AND known = true AND card.topicId = topic.id |
| topic.completionPercent (per user) | `flashcardCount == 0 ? 0 : round(knownCount / flashcardCount * 100)` |
| exercise.questionCount | count of ReadingQuestion where exerciseId = exercise.id |
| exercise.bestScore (per user) | max(score) across the user's attempts for that exercise, or null if none |
| vocabulary tags (per user) | distinct union of `tags[]` across the user's VocabularyEntry rows (powers `GET /api/vocabulary/tags`) *(v2)* |

---

## DIFF — v2 (My Vocabulary)

- **New model:** `VocabularyEntry` — `id, userId(FK User), word*, meaning*, pronunciation?, partOfSpeech?, synonyms[], antonyms[], exampleSentence?, notes?, tags[], cefrLevel?, isFavorite(def false), known(def false), createdAt, updatedAt` (`*` = required). snake_case `@map` columns; camelCase wire.
- **New relation:** `User 1—n VocabularyEntry`.
- **New indexes:** `@@index([userId, createdAt])`, optional `@@index([userId, word])`.
- **Ownership rule:** entries are private; non-owner access → `404 NOT_FOUND`.
- No changes to existing models.

---

## DIFF — v3 (SRS on FlashcardProgress)

- **Extended model:** `FlashcardProgress` gains four SRS fields:
  - `interval: Int` — default `1` — review interval in days
  - `easeFactor: Float` — default `2.5` — SM-2 ease factor
  - `nextReviewAt: DateTime?` — nullable — when the card is next due (null = never reviewed / always due)
  - `repetitions: Int` — default `0` — successful review streak
- **New index:** `@@index([userId, nextReviewAt])` — powers the due-queue scan for `GET /api/topics/:slug/review`.
- **New behavior on `PUT /api/flashcards/:id/progress`:** optional `quality ∈ [0,5]` (default `3`) drives the SM-2 update of the four SRS fields; `nextReviewAt` is also echoed on the response.
- **Reset behavior extended:** `POST /api/topics/:slug/progress/reset` now also clears SRS state (`repetitions=0`, `interval=1`, `easeFactor=2.5`, `nextReviewAt=null`) in addition to `known=false`.
- **No schema change for Feature 4** (progress chart) — daily `count` is aggregated at query time from existing `FlashcardProgress.updatedAt` + `known` (counting distinct flashcards flipped to `known=true` per UTC day per user).
- **No schema change for Feature 8** (reading→vocabulary highlight) — fully client-only; reuses existing `VocabularyEntry`/`POST /api/vocabulary`.
- **No changes** to `User`, `Topic`, `Flashcard`, `ReadingExercise`, `ReadingQuestion`, `ReadingAttempt`, `VocabularyEntry`.
- **Migration note for backend:** the four new columns on `FlashcardProgress` are non-nullable with defaults (except `nextReviewAt` which is nullable) — existing rows backfill cleanly with the defaults; no data-migration script needed beyond the Prisma migration itself.

---

## DIFF — v4 (User-created Topics & Flashcards — Feature 7)

- **Extended model:** `Topic` gains one nullable column + one relation + one index:
  - `userId: String?` — nullable FK → `User.id`. **Null = seeded (read-only); non-null = user-created (owner-writable).**
  - Relation: `owner User? @relation(...)` on Topic; inverse `topics Topic[]` on User. Relation may declare `onDelete: Cascade` so deleting a User cascades to their topics (and through existing relations down to `Flashcard` → `FlashcardProgress`).
  - Index: `@@index([userId])` — speeds "my topics" lookups and the ownership check on every mutation.
- **Ownership semantics (enforced in API layer):**
  - Seeded topics (`userId IS NULL`) are read-only for everyone — every content mutation (`POST /api/topics/:slug/flashcards`, `PUT /api/topics/:slug`, `DELETE /api/topics/:slug`, `PUT /api/flashcards/:id`, `DELETE /api/flashcards/:id`) returns `403 FORBIDDEN`.
  - User-created topics are writable only by the owner (`req.user.id === topic.userId`); cross-user mutations return `403 FORBIDDEN` (NOT 404 — the boundary is intentionally explicit).
  - **Flashcards inherit ownership from their parent Topic** — there is no `Flashcard.userId`; the ownership check always reads `flashcard.topic.userId`.
  - Per-user progress endpoints (`PUT /api/flashcards/:id/progress`, `POST /api/topics/:slug/progress/reset`, `GET /api/topics/:slug/review`) are **unchanged** and work identically for seeded and user-created topics — they mutate a user's own progress rows, not content.
- **Slug generation:** for `POST /api/topics`, server slugifies `title` (lowercase, ASCII-fold, non-alnum → `-`, collapse, trim) and appends `-2,-3,…` on collision against the **global** unique `Topic.slug` index. Slugs are immutable in v4.
- **Cascade deletes (transactional, in the API layer):**
  - `DELETE /api/topics/:slug` → delete all `FlashcardProgress` rows for cards in this topic (across **all** users) → delete all `Flashcard` rows in this topic → delete the `Topic` row.
  - `DELETE /api/flashcards/:id` → delete all `FlashcardProgress` rows for this card (across all users) → delete the `Flashcard` row.
  - The Prisma relations MAY use `onDelete: Cascade` as a safety net, but the API layer wraps these in an explicit transaction so the ordering is deterministic and observable.
- **No `order` re-pack on flashcard delete** — gaps are allowed; new cards continue from `max(existing order) + 1` (or `0` for the first card).
- **No changes** to `User` (other than the inverse `topics[]` relation), `Flashcard`, `FlashcardProgress`, `ReadingExercise`, `ReadingQuestion`, `ReadingAttempt`, `VocabularyEntry`.
- **Migration note for backend:** the new `userId` column on `Topic` is **nullable** — all existing seeded rows backfill to `NULL` (i.e. correctly classified as seeded). No data-migration script is needed beyond the Prisma migration itself. Add the `@@index([userId])` in the same migration.

---

## DIFF — v5 (Admin Reading Management)

- **New enum:** `Role { USER, ADMIN }` (Prisma `enum`).
- **Extended model:** `User` gains one column:
  - `role: Role` — default `USER`. Backfills cleanly to `USER` on existing rows; no data-migration script needed beyond the Prisma migration.
- **Authority granted by `ADMIN`:**
  - CRUD on `ReadingExercise` (create / update / delete) via the 3 new exercise endpoints.
  - CRUD on `ReadingQuestion` (create / update / delete) via the 3 new question endpoints.
  - Admins do NOT get any new authority over seeded `Topic` rows (still permanently read-only for everyone) or over other users' `Topic`/`Flashcard`/`VocabularyEntry` rows (v4 ownership rules unchanged).
- **API serialization:**
  - `role` is exposed on `GET /api/auth/me` so the frontend can guard `/admin/*` routes and conditionally render admin nav. It is NOT exposed on any other endpoint (auth register/login responses keep their existing `User` shape — frontend re-fetches `/me` after login if it needs the role).
  - `correctIndex` continues to be **excluded** from the public `ReadingExerciseDetail` response (used by `/reading/[slug]`). The new admin question-write endpoints return a separate `ReadingQuestionAdmin` shape that DOES include `correctIndex` so the admin UI can render and edit it — this is the only path on which `correctIndex` leaks to the client, and it is gated by the admin middleware.
- **No changes** to `ReadingExercise`, `ReadingQuestion`, `ReadingAttempt`, `Topic`, `Flashcard`, `FlashcardProgress`, `VocabularyEntry` columns — only the User model changes. The 6 new admin endpoints write to the existing reading tables using the existing columns; no schema migration is needed on the reading tables.
- **Migration note for backend:**
  - Add the `Role` enum + the `role` column on `User` in a single Prisma migration. Default `USER` makes the column NOT NULL safely.
  - The first ADMIN account is promoted via the seed script (or a one-off `UPDATE "User" SET role = 'ADMIN' WHERE email = ...`). There is **no** self-service "become admin" endpoint in v5.
  - The JWT payload SHOULD include `role` to avoid an extra DB read on every admin request, but the admin middleware MUST also refetch when the role claim is missing (older tokens issued before the migration) — treat missing claim as `USER` and force the user to re-login to upgrade.
