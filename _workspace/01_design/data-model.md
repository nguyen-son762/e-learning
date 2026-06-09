# Data Model — English Learning App (MVP)

> **v2 (2026-06-09): + My Vocabulary feature** — added `VocabularyEntry` (User 1—n), snake_case `@map` columns, wire stays camelCase.

Prisma data model. Postgres. All DB column names use Prisma default mapping (camelCase in schema → snake_case where noted via `@map` is optional; for MVP we keep Prisma camelCase fields). **API JSON is always camelCase** (see `api-contract.md`).

> Convention note for backend: Prisma model fields below are camelCase. Postgres columns may be snake_case if you add `@@map`/`@map`, but the **API layer must serialize camelCase regardless**.

---

## Entities

### User
A learner account. Auth is email + password (bcrypt hash), JWT issued on login.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| email | String | unique, lowercased |
| passwordHash | String | bcrypt; never serialized to API |
| name | String | display name |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |

Relations: `flashcardProgress[]`, `readingAttempts[]`, `vocabularyEntries[]`.

> No `role` field in MVP — every user is a learner. Content (topics/flashcards/reading) is seeded, not user-authored. ASSUMPTION: content authoring/instructor role is out of scope per brief.

---

### Topic
A vocabulary topic that groups flashcards (e.g. "Travel", "Business", "Food").

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| slug | String | unique, URL-safe (e.g. `travel`) |
| title | String | English display title (e.g. "Travel") |
| titleVi | String | Vietnamese label shown in UI (e.g. "Du lịch") |
| description | String? | optional short blurb (Vietnamese) |
| order | Int | sort order in lists, default 0 |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |

Relations: `flashcards[]`.

Derived (computed at query time, not stored): `flashcardCount`.

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
Per-user, per-card learned state. One row per (userId, flashcardId).

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK → User.id |
| flashcardId | String | FK → Flashcard.id |
| known | Boolean | true = "đã thuộc", false = "chưa thuộc"; default false |
| updatedAt | DateTime | @updatedAt — last time the user marked it |
| createdAt | DateTime | default now() |

Constraints: `@@unique([userId, flashcardId])`.

Semantics:
- A card with **no** progress row for a user = treated as `known: false` (not yet studied).
- "Mark thuộc/chưa thuộc" upserts this row.
- "Reset ôn lại" for a topic = set `known = false` for all the user's progress rows in that topic (rows kept, flag flipped).

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
User 1───* FlashcardProgress *───1 Flashcard *───1 Topic
User 1───* ReadingAttempt    *───1 ReadingExercise 1───* ReadingQuestion
User 1───* VocabularyEntry                                  (v2)
```

- Topic 1—* Flashcard (a topic has many cards)
- Flashcard 1—* FlashcardProgress (a card has progress rows, one per user)
- User 1—* FlashcardProgress (a user has progress across cards)
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
