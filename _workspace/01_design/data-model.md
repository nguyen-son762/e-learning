# Data Model — Multi-Language Learning App (MVP)

> **v8 (2026-06-13): + Personal Vocabulary Topics.**
> Adds a new `VocabularyTopic` table — per-user, per-language labels users can attach to their vocabulary entries (think "folders"). Adds a nullable FK `vocabularyTopicId` to `VocabularyEntry`. Enforces `(userId, language, name)` uniqueness on the new table; delete = SET NULL on referencing entries (entries are NEVER deleted by a topic delete — only the link is cleared). No change to `Topic` (the v4 flashcard bucket), `Flashcard`, or `VocabularyEntry.tags[]`. Backfill: every existing `VocabularyEntry.vocabularyTopicId` is `NULL`; the `VocabularyTopic` table starts empty. See v8 DIFF at end.
>
> **v7 (2026-06-13): + Streak/XP gamification + Sentence Mining bucket.**
> Adds three persisted gamification columns to `User` — `streak: Int @default(0)`, `lastStudiedAt: DateTime?`, `totalXP: Int @default(0)` — and introduces a new `EarnedBadge` table (one row per earned badge, `@@unique([userId, badgeId])`, never deleted). The wire-level `User.badges: Badge[]` is **derived** from this table per-request. No schema change on `Flashcard`/`FlashcardProgress` — XP/streak math is in the API layer; only the `User` row is mutated alongside the existing SRS update on `PUT /api/flashcards/:id/progress`. **Sentence mining** introduces a reserved slug `__mined__` per (userId, language) — auto-created on first `POST /api/vocabulary/mine` call. No new column on `Topic`; mining reuses the v6 `(slug, language)` composite unique. Backfill migration sets `streak=0, totalXP=0, lastStudiedAt=NULL` for all pre-v7 users and leaves `EarnedBadge` empty. See v7 DIFF at end.
>
> **v6 (2026-06-13): + Chinese Learning Module (multi-language).** Introduces a `Language` enum (`EN | ZH`) wired into four models: `User.language` (nullable — forces first-time selection), `Topic.language`, `ReadingExercise.language`, `VocabularyEntry.language`. `Flashcard` deliberately stays unchanged — language is inherited from `topic.language`. `VocabularyEntry` also gains `pinyin: String?` (Hanyu Pinyin with tone marks) and `hskLevel: Int?` (1–6). The previously-global `Topic.slug` and `ReadingExercise.slug` unique indexes are **replaced** with per-language composite uniques `@@unique([slug, language])` so `travel` may exist for both `en` and `zh`. Migration backfills `language = EN` for all existing rows; new users land with `language = NULL` and must pick on first login. See v6 DIFF at end.
>
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
| language | Language? | *(v6)* `EN` \| `ZH` \| `null`; **nullable** — null = user has never picked. Forces redirect to `/choose-language` after auth. Default `null` for new rows; backfill `EN` for pre-v6 rows. |
| streak | Int | *(v7)* consecutive-day study streak; **default `0`**; backfill `0` for pre-v7 rows. Updated server-side on every `PUT /api/flashcards/:id/progress`. Language-agnostic. |
| lastStudiedAt | DateTime? | *(v7)* timestamp of the user's most recent SRS rating event (any quality, any language); nullable; **default `NULL`**; backfill `NULL`. Used by the streak machine to decide same-day / consecutive-day / streak-break. |
| totalXP | Int | *(v7)* lifetime XP; **default `0`**; backfill `0`. Increments by `[0,5,10,15][quality]` on every SRS rating event. Language-agnostic. |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |

Relations: `flashcardProgress[]`, `readingAttempts[]`, `vocabularyEntries[]`, `topics[]` *(v4 — user-created topics owned by this user)*, `earnedBadges[]` *(v7 — see EarnedBadge below)*, `vocabularyTopics[]` *(v8 — personal vocabulary topics owned by this user; see VocabularyTopic below)*.

#### Role enum *(v5)*

```prisma
enum Role {
  USER
  ADMIN
}
```

Prisma column: `role Role @default(USER)`. The JWT payload MAY embed `role` to short-circuit DB lookups on the admin middleware, but the authoritative source remains the `User.role` column — refetch on token refresh / role change.

#### Language enum *(v6)*

```prisma
enum Language {
  EN
  ZH
}
```

Wire representation is **lowercase** (`"en"`, `"zh"`) — Prisma serializers should `toLowerCase()` on the way out and `toUpperCase()` on the way in. Used by `User.language` (nullable), `Topic.language`, `ReadingExercise.language`, `VocabularyEntry.language`. **Not** used by `Flashcard` (inherits from parent topic). New users have `language = NULL` and are forced through `/choose-language`; existing users were backfilled to `EN` by the v6 migration so they keep going to `/dashboard` directly.

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
| slug | String | URL-safe (e.g. `travel`); for user-created topics, auto-generated server-side from `title`. **`@@unique([slug, language])` *(v6)*** — unique within a language, NOT globally. |
| title | String | display title in source language (e.g. "Travel", "你好") |
| titleVi | String | Vietnamese label shown in UI (e.g. "Du lịch") |
| description | String? | optional short blurb (Vietnamese) |
| order | Int | sort order in lists, default 0 |
| userId | String? | *(v4)* nullable FK → `User.id`. **`null` = seeded content (read-only for all users)**; **non-null = user-created (only that user may edit/delete)**. Prisma relation may declare `onDelete: Cascade` so deleting a user removes their topics (and their cards / progress rows through the existing cascade). |
| language | Language | *(v6)* `EN` \| `ZH`; **non-null**, immutable after creation. Backfill `EN` for all pre-v6 rows. |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |

Relations: `flashcards[]`, `owner` (User?) *(v4 — null when seeded)*.

Indexes:
- `@@index([userId])` *(v4)* — powers "list this user's topics" filtering and the ownership check on every mutation (PUT/DELETE topic, POST/PUT/DELETE flashcard).
- `@@unique([slug, language])` *(v6)* — **replaces** the v0 global `@unique` on `slug`. Lets `en/travel` and `zh/travel` coexist. Dedup suffix logic (`-2,-3,…`) for `POST /api/topics` is computed per-language.
- `@@index([language])` *(v6)* — powers `GET /api/topics?language=...` filtering and dashboard scoping.

Derived (computed at query time, not stored): `flashcardCount`.

**Ownership semantics (v4) — enforced in the API layer on every mutation:**
- **Seeded topics (`userId === null`)**: read-only for ALL users. Any `POST /api/topics/:slug/flashcards`, `PUT /api/topics/:slug`, `DELETE /api/topics/:slug`, `PUT /api/flashcards/:id`, or `DELETE /api/flashcards/:id` against a seeded topic → `403 FORBIDDEN`. Read endpoints (`GET /api/topics`, `GET /api/topics/:slug`, dashboard) and per-user progress mutations (`PUT /api/flashcards/:id/progress`, `POST /api/topics/:slug/progress/reset`) still work normally — those are not content mutations.
- **User-created topics (`userId !== null`)**: writable by the owner only (`req.user.id === topic.userId`). Any cross-user mutation → `403 FORBIDDEN` (NOT 404 — we surface the permission boundary explicitly so the frontend can show a clear "không có quyền" message). Reads still work for any authed user, same as seeded content.
- **Flashcards inherit ownership from their parent `Topic`** — there is no `Flashcard.userId`. The check on `POST /api/topics/:slug/flashcards`, `PUT /api/flashcards/:id`, and `DELETE /api/flashcards/:id` is always against `flashcard.topic.userId`.

---

### Flashcard
A single vocabulary card belonging to a topic. **Language is NOT stored on the card** *(v6)* — it is derived from `topic.language`. This is a deliberate choice: language never differs from the parent topic, so storing it would invite drift bugs and bloat the cards table.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| topicId | String | FK → Topic.id |
| front | String | word/phrase on card front. *(v6)* For `topic.language === EN`: English text. For `topic.language === ZH`: Hán tự (Simplified Hanzi). |
| back | String | Vietnamese meaning on card back. *(v6)* For `topic.language === ZH`: convention is `"pinyin — Vietnamese meaning"` (e.g. `"nǐ hǎo — xin chào"`) so the back ALWAYS carries the pinyin even though the card has no dedicated field. Frontend MAY parse this convention to render pinyin as a distinct line; backend stores the string verbatim. |
| example | String? | example sentence on card back. *(v6)* For `topic.language === ZH`: convention is bilingual — `"<Chinese sentence> (<pinyin>) — <Vietnamese gloss>"` joined in the single column. |
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
| slug | String | URL-safe. *(v6)* **`@@unique([slug, language])`** — unique per-language, NOT globally. |
| title | String | exercise title in source language |
| passage | String (Text) | the reading passage, may be multi-paragraph. *(v6)* For `language === ZH`: Simplified Hanzi, MVP 100–200 char passages (HSK 2–3). |
| level | String | difficulty label. For `EN`: `beginner` \| `intermediate` \| `advanced`. *(v6)* For `ZH`: `HSK1` \| `HSK2` \| `HSK3` (HSK 4–6 out of scope). The column is `String` — backend does NOT enforce the enum-like values; the admin form constrains them. |
| order | Int | sort order, default 0 |
| language | Language | *(v6)* `EN` \| `ZH`; **non-null**, immutable after creation. Backfill `EN` for all pre-v6 rows. |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |

Relations: `questions[]` (ReadingQuestion), `attempts[]` (ReadingAttempt).

Indexes *(v6)*:
- `@@unique([slug, language])` — replaces the v0 global `@unique` on `slug`.
- `@@index([language])` — powers `GET /api/reading-exercises?language=...` filtering.

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
| cefrLevel | String? | `cefr_level` | optional; if present must be one of `A1 A2 B1 B2 C1 C2`. *(v6)* MUST be `null` when `language === ZH`. |
| pinyin | String? | `pinyin` | *(v6)* Hanyu Pinyin with tone marks (e.g. `"nǐ hǎo"`); optional. MUST be `null` when `language === EN`. |
| hskLevel | Int? | `hsk_level` | *(v6)* HSK level for Chinese vocabulary; if present must be an integer in `[1, 6]`. MUST be `null` when `language === EN`. |
| language | Language | `language` | *(v6)* `EN` \| `ZH`; **non-null**, immutable after creation. Backfill `EN` for all pre-v6 rows. |
| vocabularyTopicId | String? | `vocabulary_topic_id` | *(v8)* nullable FK → `VocabularyTopic.id`. **Null = untagged (default).** Must reference a topic where `userId = this.userId` AND `language = this.language` — enforced at the API layer (no DB-level cross-field check). Cascade: `ON DELETE SET NULL` (entry survives; tag is cleared). Backfill `NULL` for all pre-v8 rows. |
| isFavorite | Boolean | `is_favorite` | star flag; **default false** |
| known | Boolean | `known` | flashcard-study "thuộc" state; **default false** |
| createdAt | DateTime | `created_at` | default now() |
| updatedAt | DateTime | `updated_at` | @updatedAt |

Relations: `user` (User).

Indexes:
- `@@index([userId, createdAt])` — default list ordering (newest-first) scoped to owner.
- `@@index([userId, word])` — optional; speeds word lookup/search and de-dup checks within a user's set.
- `@@index([userId, language, createdAt])` *(v6)* — replaces the dominant query path: list owner's entries filtered by language, ordered newest-first. The pure `@@index([userId, createdAt])` stays for queries that don't filter by language (none in v6, but kept for forward-compat).
- `@@index([userId, vocabularyTopicId])` *(v8)* — powers `GET /api/vocabulary?vocabularyTopicId=<id>` filtering. Also powers the `DELETE /api/vocabulary-topics/:id` SET NULL cascade scan (find every entry referencing the topic). The `userId` prefix keeps the scan scoped to the caller's rows.

> Convention: model fields camelCase in Prisma schema, Postgres columns snake_case via `@map`/`@@map`. API serializes camelCase (see `api-contract.md`). `known` lives **directly on the entry** (not in a separate progress table) because a vocabulary entry already belongs to exactly one user — no per-user fan-out needed, unlike `Flashcard`/`FlashcardProgress`.

Validation (enforced at API layer):
- `word`, `meaning`: trimmed, length ≥ 1 → else `400 VALIDATION_ERROR`.
- `cefrLevel`: if provided, ∈ `{A1,A2,B1,B2,C1,C2}` → else `400 VALIDATION_ERROR`.
- `synonyms` / `antonyms` / `tags`: arrays of strings (omitted/null → treated as `[]`).
- *(v6)* `language` ∈ `{EN, ZH}` (case-insensitive on the wire, stored uppercase) → else `400 VALIDATION_ERROR`.
- *(v6)* `hskLevel`: if provided, integer in `[1, 6]` → else `400 VALIDATION_ERROR`.
- *(v6)* **Cross-field rules** — language gates which level field may carry data:
  - `language = EN` ⇒ `pinyin IS NULL` AND `hskLevel IS NULL`. If body supplies either → `400 VALIDATION_ERROR` ("Trường `pinyin`/`hskLevel` chỉ dùng cho tiếng Trung.").
  - `language = ZH` ⇒ `cefrLevel IS NULL`. If body supplies it → `400 VALIDATION_ERROR` ("Trường `cefrLevel` không áp dụng cho tiếng Trung — dùng `hskLevel`.").
- *(v6)* `language` is **immutable on PUT** — the API layer either silently ignores or 400s if the body changes it (recommendation: 400 with a clear message; switching language means delete-and-recreate).

---

### EarnedBadge  *(v7 — Gamification)*
A persistent record that a user has earned a built-in badge. Append-only — once a row exists for `(userId, badgeId)`, it is never deleted or updated. The wire `User.badges: Badge[]` is materialized from this table on every request that returns `User`.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK → User.id (owner) |
| badgeId | String | one of `"first-review"`, `"week-streak"`, `"century-xp"` (string column, not an enum — keeps it easy to add badges in future versions without a migration) |
| earnedAt | DateTime | timestamp the badge was first detected; defaults to `now()` |

Relations: `user` (User).

Constraints:
- `@@unique([userId, badgeId])` — at most one row per (user, badge). Earning attempts after the first are no-ops.
- `@@index([userId])` — powers the per-request "what badges does this user have?" lookup that drives `User.badges`.

Semantics:
- Detection happens server-side after every `PUT /api/flashcards/:id/progress` that updates `streak` or `totalXP` (or in the same transaction as the `first-review` check). Triggers:
  - `first-review` — earned the first time a user completes a `PUT /api/flashcards/:id/progress` (any quality).
  - `week-streak` — earned the first time `user.streak >= 7` after the update.
  - `century-xp` — earned the first time `user.totalXP >= 100` after the update.
- The check is idempotent — the unique constraint absorbs concurrent double-earn attempts (P2002 → ignore).
- **Labels live in code**, NOT in the DB — the wire `Badge.label` is looked up from a server-side constant map `BADGE_LABELS = { "first-review": "Đánh giá đầu tiên", "week-streak": "7 ngày liên tiếp", "century-xp": "100 XP" }` so the SSOT for display strings is alongside the badge detection logic. Adding a new badge in v8 requires updating the map AND the detection code together.

> ASSUMPTION: badges are never revoked, even if the user resets their topic progress or deletes their mined-topic. v7 doesn't expose any path for badge removal.

---

### VocabularyTopic  *(v8 — Personal Vocabulary Topics)*
A per-user, per-language label users can attach to their `VocabularyEntry` rows (think "folders"). Distinct from `Topic` (the v4 flashcard bucket) and from `VocabularyEntry.tags[]` (free-text labels). A first-class owned object with `id`/`color` for UI use.

| Field | Type | DB `@map` | Notes |
|-------|------|-----------|-------|
| id | String (cuid) | `id` | PK |
| userId | String | `user_id` | FK → User.id (owner). Cross-user access → `404 NOT_FOUND` (existence not leaked). |
| name | String | `name` | Trimmed before storage; length 1–60; case preserved. |
| color | String? | `color` | Optional hex `#RRGGBB` (six-digit, leading `#`). Nullable — null = frontend renders default chip color. |
| language | Language | `language` | *(v8)* `EN` \| `ZH`; **non-null**, **immutable** after creation. Matches `Topic`/`VocabularyEntry` precedent. |
| createdAt | DateTime | `created_at` | default now() |
| updatedAt | DateTime | `updated_at` | @updatedAt |

Relations:
- `user` (User) — `userId` references `User.id`. `onDelete: Cascade` so deleting a user drops their topics (and the v8 SET NULL on the entries' FK handles the entry-side cleanup cleanly because the entry's parent user is also being deleted in the same cascade).
- `entries` (VocabularyEntry[]) — inverse of the new `vocabularyTopicId` FK on entries. The relation uses `onDelete: SetNull` on the entry side so deleting the topic unlinks entries without deleting them.

Constraints:
- `@@unique([userId, language, name])` — naming uniqueness scoped per (user, language). Two users may both name a topic "Travel" in `en`; the same user may have an `en/Travel` AND a `zh/Travel`; the same user may NOT have two `en/Travel`. Collision on create/rename → `409 TOPIC_NAME_CONFLICT` at the API layer.

Indexes:
- `@@index([userId, language, name])` — implied by the unique above; powers `GET /api/vocabulary-topics?language=...` (filter by owner+language, order by name).
- `@@index([userId])` — fallback lookups (e.g. "all my topics across both languages") if needed in future; cheap to keep alongside the unique.

Semantics:
- Each `VocabularyEntry` may reference AT MOST one `VocabularyTopic` via `vocabularyTopicId` (nullable); `null` = untagged.
- An entry's `vocabularyTopicId` must point to a topic with the **same** `userId` AND **same** `language` as the entry. Cross-user / cross-language assignment is rejected at the API layer (no DB-level constraint — checked in the controller).
- Renaming a topic does NOT touch entries — only the topic row's `name` changes. Frontend chips re-render on the next refetch.
- Deleting a topic clears the FK on every referencing entry (SET NULL via Prisma relation `onDelete: SetNull`), then drops the topic row. The two steps run in a single transaction at the API layer for predictable ordering and for atomic visibility.

> ASSUMPTION: a `VocabularyTopic` is purely an owner-side label. There is no sharing, no copy-on-clone, no "make this topic public" affordance in v8. If a user deletes their account, their topics are deleted via the `User → VocabularyTopic` cascade; their entries are deleted via the existing `User → VocabularyEntry` cascade.

---

## Relationships (summary)

```
User 1───* FlashcardProgress *───1 Flashcard *───1 Topic *───0..1 User    (v4 — owner; 0 = seeded)
User 1───* ReadingAttempt    *───1 ReadingExercise 1───* ReadingQuestion
User 1───* VocabularyEntry  *───0..1 VocabularyTopic *───1 User           (v8 — entry may be tagged with one of its owner's topics)
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
- User 1—* EarnedBadge *(v7 — append-only badge log; one row per (user, badge))*
- User 1—* VocabularyTopic *(v8 — owner of personal vocabulary topics; per-language unique by name)*
- VocabularyTopic 1—* VocabularyEntry *(v8 — optional FK on entry; `onDelete: SetNull` so deleting a topic untags entries instead of dropping them)*

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

---

## DIFF — v6 (Multi-Language: Chinese Learning Module)

### New enum

```prisma
enum Language {
  EN
  ZH
}
```

Wire form is lowercase (`"en"`, `"zh"`). The Prisma layer normalizes on the boundary.

### Extended models

- **`User`** gains:
  - `language: Language?` — **nullable**; default `null` for new rows; `EN` for backfilled pre-v6 rows. Null = forced through `/choose-language` after auth.
- **`Topic`** gains:
  - `language: Language` — non-null; default not declared at DB level (backend always supplies), but Prisma column type allows backfill.
  - Replaces global `@unique` on `slug` with `@@unique([slug, language])`.
  - Adds `@@index([language])`.
- **`ReadingExercise`** gains:
  - `language: Language` — non-null; same shape as Topic.
  - Replaces global `@unique` on `slug` with `@@unique([slug, language])`.
  - Adds `@@index([language])`.
- **`VocabularyEntry`** gains:
  - `language: Language` — non-null, immutable.
  - `pinyin: String?` — Hanyu Pinyin with tone marks; nullable; MUST be null when `language = EN`.
  - `hskLevel: Int?` — integer 1–6; nullable; MUST be null when `language = EN`.
  - Adds `@@index([userId, language, createdAt])`.
- **`Flashcard`** — **unchanged**. Language is inherited from parent `Topic`. Convention for `back`/`example` content when `topic.language = ZH` is documented in the Flashcard table (pinyin + Vietnamese in the same string).

### Unchanged models

`FlashcardProgress`, `ReadingQuestion`, `ReadingAttempt` — no column changes. Their semantics are language-agnostic because the parent resource (Flashcard's topic, ReadingQuestion's exercise, ReadingAttempt's exercise) carries the language.

### Ownership / visibility semantics

- All v4 ownership rules unchanged. The new `language` column does NOT participate in the ownership check.
- A user-created topic carries the creator's `language` at the moment of creation (or whatever was passed in the body) — switching the creator's `user.language` later does NOT retroactively change the topic's language.
- Cross-language reads are allowed (`GET /api/topics/:slug` returns the topic regardless of `user.language`). Frontend may nudge a switch in UI but the API does not block.

### Migration plan

Single Prisma migration `2026_06_13_add_language`:

1. **Add `Language` enum** to the schema.
2. **Drop existing unique indexes** on `Topic.slug` and `ReadingExercise.slug` (they will be replaced by composites).
3. **Add `language` column** to `User` (nullable, default `NULL` for new rows), `Topic`, `ReadingExercise`, `VocabularyEntry` (non-null with no default — see step 4 for the backfill).
4. **Backfill in the same migration** (raw SQL inside the Prisma migration file):
   ```sql
   UPDATE "User"             SET "language" = 'EN' WHERE "language" IS NULL;  -- ALL pre-v6 users, keeping them out of the language gate
   UPDATE "Topic"            SET "language" = 'EN';
   UPDATE "ReadingExercise"  SET "language" = 'EN';
   UPDATE "VocabularyEntry"  SET "language" = 'EN';
   ```
   For `User.language` the column is **kept nullable** (we only backfill existing rows; new rows still default to `NULL` so the language-gate kicks in for new sign-ups).
   For `Topic`/`ReadingExercise`/`VocabularyEntry`, the backfill runs BEFORE the column is marked `NOT NULL` (Prisma migration: add nullable → backfill → alter to NOT NULL).
5. **Add new pinyin/hskLevel columns** to `VocabularyEntry` (both nullable). No backfill needed.
6. **Create new indexes:**
   - `CREATE UNIQUE INDEX "Topic_slug_language_key" ON "Topic"("slug", "language");`
   - `CREATE UNIQUE INDEX "ReadingExercise_slug_language_key" ON "ReadingExercise"("slug", "language");`
   - `CREATE INDEX "Topic_language_idx" ON "Topic"("language");`
   - `CREATE INDEX "ReadingExercise_language_idx" ON "ReadingExercise"("language");`
   - `CREATE INDEX "VocabularyEntry_userId_language_createdAt_idx" ON "VocabularyEntry"("userId", "language", "created_at" DESC);`

The migration is forward-only and idempotent under Prisma's migration tracking. Rollback path is documented in the deploy notes (devops-deployer) but is **not** auto-generated — the slug uniqueness change is destructive to roll back (would need de-duplication).

### Validation rules summary (enforced at API layer)

| Field | Rule |
|-------|------|
| `User.language` | `EN` \| `ZH` \| `NULL` |
| `Topic.language` | `EN` \| `ZH`, immutable after create |
| `ReadingExercise.language` | `EN` \| `ZH`, immutable after create |
| `VocabularyEntry.language` | `EN` \| `ZH`, immutable after create |
| `VocabularyEntry.pinyin` | nullable string; MUST be null when `language = EN` |
| `VocabularyEntry.hskLevel` | nullable integer 1–6; MUST be null when `language = EN` |
| `VocabularyEntry.cefrLevel` | nullable, ∈ `{A1..C2}`; MUST be null when `language = ZH` |

Cross-field violations → `400 VALIDATION_ERROR` with a Vietnamese `message`.

### What does NOT change

- `FlashcardProgress` schema (no SRS field change).
- `ReadingQuestion`, `ReadingAttempt` schemas.
- v4 ownership semantics, v3 SRS logic, v5 admin/role semantics — all carry over verbatim.
- `Flashcard` shape — no language column.

### Backend implementation notes

- Add an `auth` middleware helper `resolveLanguage(req, queryParam, bodyField)` that returns `req.query.language ?? req.body.language ?? req.user.language ?? throw 403 LANGUAGE_NOT_SELECTED`. Reuse on every list/dashboard handler and every create handler.
- The `403 LANGUAGE_NOT_SELECTED` error must NOT be thrown by `PUT /api/users/me/language`, detail endpoints, or any endpoint with an explicit language argument.
- JWT payload MAY include `language` to skip a DB hit, but the language-switch handler (`PUT /api/users/me/language`) MUST issue a new token (or refresh) so the JWT and DB stay in sync. If the JWT does not carry language, the middleware re-reads the column on every request.
- The seed script (devops) is responsible for seeding HSK 1–3 topics (≥13 topics, ≥200 flashcards) and 2–3 HSK 2–3 reading exercises, all with `language = ZH`. Existing English seeds keep `language = EN`. See `feature-chinese-learning.md` §5 for content scope.

---

## DIFF — v7 (Gamification + Sentence Mining)

### Extended model — `User` gains three persisted gamification columns

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `streak` | Int | `0` | consecutive-day study streak; updated on every flashcard SRS rating; backfill `0` |
| `lastStudiedAt` | DateTime? | `NULL` | timestamp of last SRS rating event (any quality, any language); backfill `NULL` |
| `totalXP` | Int | `0` | lifetime XP; backfill `0` |

`badges` does NOT exist as a column — it's derived per-request from `EarnedBadge`.

### New model — `EarnedBadge`

```prisma
model EarnedBadge {
  id        String   @id @default(cuid())
  userId    String
  badgeId   String   // "first-review" | "week-streak" | "century-xp"
  earnedAt  DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, badgeId])
  @@index([userId])
}
```

Append-only — `PUT`/`DELETE` are never issued. Concurrent double-earn is absorbed by the unique constraint.

### Unchanged models

`Flashcard`, `FlashcardProgress`, `Topic`, `ReadingExercise`, `ReadingQuestion`, `ReadingAttempt`, `VocabularyEntry` — no column changes. v7's SRS rating mutation continues to use the existing `FlashcardProgress` columns; gamification side-effects mutate `User` + `EarnedBadge` in the same transaction.

### Sentence Mining — no new schema

`POST /api/vocabulary/mine` reuses the v4/v6 user-created Topic shape with a **reserved slug `__mined__`** scoped per (`userId`, `language`) — enforced by the v6 `@@unique([slug, language])` plus the per-user `userId` filter in the controller. No new Topic column; no new `VocabularyEntry` column.

The vocabulary entry created by mining lives in the existing `VocabularyEntry` table with `language` matching the body. It is NOT linked to the mined-topic via a hard FK (vocabulary entries are owner-scoped, not topic-scoped — the mined-topic exists only to surface "you have X mined items" in `GET /api/topics`).

### Migration plan

Single Prisma migration `2026_06_13_add_gamification`:

1. **Add columns** to `User`:
   ```sql
   ALTER TABLE "User" ADD COLUMN "streak"        INT NOT NULL DEFAULT 0;
   ALTER TABLE "User" ADD COLUMN "lastStudiedAt" TIMESTAMP;
   ALTER TABLE "User" ADD COLUMN "totalXP"       INT NOT NULL DEFAULT 0;
   ```
   Defaults handle backfill cleanly — no data-migration script needed.
2. **Create `EarnedBadge` table** with the schema above + unique + index.
3. The migration is forward-only. Rollback drops the three User columns + the EarnedBadge table; no destructive data loss (badges/streaks are transient gamification state).

### Validation rules summary (enforced at API layer)

| Field | Rule |
|-------|------|
| `User.streak` | integer ≥ 0; clients never write it directly |
| `User.lastStudiedAt` | nullable ISO 8601 UTC; clients never write it directly |
| `User.totalXP` | integer ≥ 0; clients never write it directly |
| `EarnedBadge.badgeId` | server-side constant: one of `{"first-review","week-streak","century-xp"}`. The DB type is `String` to keep future badges additive without migrations. |
| `POST /api/vocabulary/mine` `word` | trimmed, non-empty string |
| `POST /api/vocabulary/mine` `exampleSentence` | trimmed, non-empty string |
| `POST /api/vocabulary/mine` `language` | required; `"en"` \| `"zh"` (lowercase wire); else `400 VALIDATION_ERROR` |

### Backend implementation notes

- The SRS handler should run a **single transaction** that: (a) upserts `FlashcardProgress` with the new SM-2 numbers, (b) updates `User.streak/lastStudiedAt/totalXP`, (c) inserts any newly-earned `EarnedBadge` rows (catch P2002 and ignore — concurrent double-earn). The response is assembled from the final state of the User row + the upserted progress row + the constant `xpEarned`.
- The mining handler should run a **single transaction** that: (a) finds-or-creates the `(userId, "__mined__", language)` Topic, (b) creates the `VocabularyEntry`. The find-or-create can be a `Prisma.$transaction` with `upsert` on Topic and `create` on entry — the v6 `@@unique([slug, language])` index does NOT include `userId`, so the upsert MUST filter by `userId, slug, language` and the controller does the dedup.
- Compute `dueToday` for the dashboard as: `count(Flashcard) WHERE topic.language = resolvedLanguage AND (no FlashcardProgress row for (me, fc.id) OR FlashcardProgress.nextReviewAt <= now())`. Two-step: (1) count cards in language-scoped topics, (2) subtract cards with a progress row whose `nextReviewAt > now()`. Or do it directly with a `LEFT JOIN` on FlashcardProgress.

### What does NOT change

- v6 multi-language semantics, slug-collision rules, language gating.
- v5 admin role + reading CRUD.
- v4 ownership semantics.
- v3 SM-2 math (still 0–5 SM-2 internal; only the wire input changes to 0–3).
- All existing endpoints' response status codes.
- `Flashcard` shape (still language-derived).

---

## DIFF — v8 (Personal Vocabulary Topics)

### New model — `VocabularyTopic`

```prisma
model VocabularyTopic {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  name      String
  color     String?
  language  Language
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  user    User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries VocabularyEntry[]

  @@unique([userId, language, name])
  @@index([userId])
  @@map("vocabulary_topics")
}
```

- `(userId, language, name)` is the uniqueness boundary. Two users may both have `en/Travel`; one user may have both `en/Travel` AND `zh/Travel`; one user may NOT have two `en/Travel`. Collision → API-layer `409 TOPIC_NAME_CONFLICT`.
- `language` is `Language` (the v6 enum), non-null, immutable after create. Matches `Topic`/`VocabularyEntry` precedent.
- `color` is a free-form string at the DB level; format validation `^#[0-9A-Fa-f]{6}$` happens at the API layer. Nullable.

### Extended model — `VocabularyEntry` gains one nullable FK column

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `vocabularyTopicId` (DB `vocabulary_topic_id`) | `String?` | `NULL` | nullable FK → `VocabularyTopic.id`. Prisma relation declares `onDelete: SetNull` so deleting a topic clears the FK on referencing entries (no entry data loss). Cross-user / cross-language assignment is rejected at the API layer (no DB check). Backfill `NULL` for all pre-v8 rows. |

Prisma relation on the entry side:

```prisma
vocabularyTopicId String?         @map("vocabulary_topic_id")
vocabularyTopic   VocabularyTopic? @relation(fields: [vocabularyTopicId], references: [id], onDelete: SetNull)
```

### New / extended indexes

- New: `VocabularyTopic` table — `@@unique([userId, language, name])` + `@@index([userId])`.
- Extended: `VocabularyEntry` adds `@@index([userId, vocabularyTopicId])` — powers the `?vocabularyTopicId=` filter on `GET /api/vocabulary` AND the SET NULL cascade scan on `DELETE /api/vocabulary-topics/:id`. The existing v6 `@@index([userId, language, createdAt])` stays as the dominant list path.

### Unchanged models

- `Topic` *(v4 flashcard bucket)* — NOT renamed, NOT extended. The v8 `VocabularyTopic` is a sibling model, not a rename of `Topic`. Backend MUST keep them in separate tables (`topics` vs `vocabulary_topics`).
- `Flashcard`, `FlashcardProgress`, `ReadingExercise`, `ReadingQuestion`, `ReadingAttempt`, `User`, `EarnedBadge` — no column changes.
- `VocabularyEntry.tags[]` — UNCHANGED. The new `vocabularyTopicId` is orthogonal; both filters coexist on `GET /api/vocabulary` and AND together. There is no server-side migration from tags to topics — users may use either, both, or neither.

### Cascade / referential integrity summary

| Action | Effect |
|--------|--------|
| `DELETE FROM User WHERE id = X` | Cascades to `VocabularyTopic.userId = X` (drops the topic rows) AND to `VocabularyEntry.userId = X` (drops the entry rows). Both rely on existing/new `onDelete: Cascade` relations on the `userId` FKs. |
| `DELETE FROM VocabularyTopic WHERE id = T` | `VocabularyEntry.vocabularyTopicId = T` is SET NULL. Entries persist as untagged. API layer wraps the SET NULL + the DELETE in a single transaction for atomic visibility. |
| Cross-language reassignment via `PUT /api/vocabulary/:id { vocabularyTopicId: <wrong-language topic> }` | API-layer rejection (`400 VALIDATION_ERROR`). NOT enforced at the DB — the controller compares `entry.language` against `topic.language` before writing. |
| Cross-user assignment via the same path | API-layer rejection (`400 VALIDATION_ERROR` if topic owned by another user — also surfaces as `404` if the topic lookup itself returns null because of the existence-not-leaked rule; either is acceptable). |

### Migration plan

Single Prisma migration `2026_06_13_add_vocabulary_topics`:

1. **Create `vocabulary_topics` table** with the schema above + the `(userId, language, name)` unique index + the `(userId)` secondary index.
   ```sql
   CREATE TABLE "vocabulary_topics" (
     "id"         TEXT PRIMARY KEY,
     "user_id"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
     "name"       TEXT NOT NULL,
     "color"      TEXT,
     "language"   "Language" NOT NULL,
     "created_at" TIMESTAMP NOT NULL DEFAULT now(),
     "updated_at" TIMESTAMP NOT NULL DEFAULT now()
   );
   CREATE UNIQUE INDEX "vocabulary_topics_user_id_language_name_key" ON "vocabulary_topics"("user_id", "language", "name");
   CREATE INDEX "vocabulary_topics_user_id_idx" ON "vocabulary_topics"("user_id");
   ```
2. **Add `vocabulary_topic_id` column** to `vocabulary_entries` (nullable, default `NULL`, no backfill needed):
   ```sql
   ALTER TABLE "vocabulary_entries"
     ADD COLUMN "vocabulary_topic_id" TEXT
     REFERENCES "vocabulary_topics"("id") ON DELETE SET NULL;
   CREATE INDEX "vocabulary_entries_user_id_vocabulary_topic_id_idx"
     ON "vocabulary_entries"("user_id", "vocabulary_topic_id");
   ```
3. The migration is forward-only. Rollback drops the new column + index + table; no data loss because no pre-v8 data references the new structures.

### Validation rules summary (enforced at API layer)

| Field | Rule |
|-------|------|
| `VocabularyTopic.name` | trimmed; length 1–60; non-empty after trim |
| `VocabularyTopic.color` | optional; if provided, MUST match `^#[0-9A-Fa-f]{6}$` |
| `VocabularyTopic.language` | `EN` \| `ZH`; immutable after create |
| `VocabularyTopic` uniqueness | `(userId, language, name)` — DB-enforced; P2002 mapped to `409 TOPIC_NAME_CONFLICT` |
| `VocabularyEntry.vocabularyTopicId` (write) | nullable; if non-null, MUST point to a topic with matching `userId` AND matching `language` — else `400 VALIDATION_ERROR` with `field: "vocabularyTopicId"` |
| `POST /api/vocabulary/mine` body `vocabularyTopicId` | MUST NOT be present in the body — explicit reject with `400 VALIDATION_ERROR` |
| `?vocabularyTopicId=` on `GET /api/vocabulary` | sentinel `"__none__"` → `IS NULL`; any other string → exact match; unknown id → empty list (no error) |

### Backend implementation notes

- The cross-field language check on `vocabularyTopicId` writes happens **after** the existing v6 language resolution for the entry — i.e. resolve the entry's stored language first, then lookup the topic, then compare. Don't trust a client-supplied `language` on a PUT path; the entry's stored language is the SSOT.
- `DELETE /api/vocabulary-topics/:id` runs `UPDATE entries SET vocabulary_topic_id = NULL WHERE user_id = $1 AND vocabulary_topic_id = $2; DELETE FROM vocabulary_topics WHERE id = $2 AND user_id = $1;` inside one Prisma `$transaction`. The `user_id = $1` filter on both statements is defensive — the relation's `onDelete: SetNull` would also handle the first statement implicitly, but the explicit SQL is cheaper at small volumes and avoids hidden latency from Prisma's relation cleanup.
- The `(userId, vocabularyTopicId)` index makes the SET NULL scan an indexed range read — for a user with thousands of entries and dozens of topics, this is the right shape.
- For `GET /api/vocabulary?vocabularyTopicId=__none__`, the WHERE clause is `vocabulary_topic_id IS NULL AND user_id = $1 AND language = $resolvedLanguage` — the existing `(userId, language, createdAt)` index still dominates the scan; the `IS NULL` filter applies after.
- The `name` trim happens BEFORE the uniqueness check; storing `"IELTS "` and `"IELTS"` as duplicates is a UX papercut — both normalize to `"IELTS"` and collide cleanly.

### What does NOT change

- v7 SRS / XP / streak / badges / sentence mining — completely orthogonal.
- v7 mined-topic (`Topic` slug `__mined__`) — still a `Topic`, NOT a `VocabularyTopic`. Mining does NOT auto-assign a `VocabularyTopic` to the mined entry.
- v6 multi-language gating, slug-collision rules, language enum.
- v5 admin role + reading CRUD.
- v4 ownership semantics for `Topic`/`Flashcard`.
- v3 SM-2 math.
- `VocabularyEntry.tags[]` — still an independent free-text array.
- All existing endpoints' response status codes (other than the new `409 TOPIC_NAME_CONFLICT`).

