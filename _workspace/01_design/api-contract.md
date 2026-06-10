# API Contract — English Learning App (MVP)

> **v4 (2026-06-10): + User-created Topics & Flashcards (Feature 7).**
> - `TopicSummary` / `TopicDetail` gain `userId: string | null` — `null` = seeded (read-only); non-null = owner-writable.
> - New error code `403 FORBIDDEN` for non-owner mutations on user-created content.
> - 6 new endpoints: `POST /api/topics`, `PUT /api/topics/:slug`, `DELETE /api/topics/:slug`, `POST /api/topics/:slug/flashcards`, `PUT /api/flashcards/:id`, `DELETE /api/flashcards/:id`.
> - No changes to seeded-content read endpoints; existing flashcard progress endpoints unchanged.
> Same conventions (camelCase, `{items,total}` list wrapper, `{error:{code,message}}`, Bearer auth). See v4 DIFF at end.
>
> **v3 (2026-06-10): + Progress chart, + Spaced Repetition (SRS), + Reading→Vocabulary highlight.**
> - Feature 4 — `GET /api/dashboard/progress-history` (new).
> - Feature 5 — `PUT /api/flashcards/:id/progress` now accepts optional `quality` (SM-2); new `GET /api/topics/:slug/review` (due-cards queue) + `nextReviewAt` returned on the progress mutation.
> - Feature 8 — Reading highlight → vocabulary is CLIENT-ONLY for selection/UX; uses the existing `POST /api/vocabulary` unchanged. No backend changes.
> Same conventions (camelCase, `{items,total}` list wrapper, `{error:{code,message}}`, Bearer auth). See v3 DIFF at end.
>
> **v2 (2026-06-09): + My Vocabulary feature** — added 8 `/api/vocabulary*` endpoints + `VocabularyEntry` shape. Same conventions (camelCase, `{items,total}` list wrapper, `{error:{code,message}}`, Bearer auth). Dictionary auto-fill + TTS are CLIENT-ONLY and NOT in this contract. See DIFF at end.

**SINGLE SOURCE OF TRUTH.** Frontend types its hooks to these shapes; backend serializes exactly these shapes. Do not diverge from this file without broadcasting a diff to frontend-engineer and backend-engineer.

## Global conventions (BẮT BUỘC)

1. **All JSON fields are camelCase.** Prisma/Postgres columns may be snake_case internally, but every response/request body field over the wire is camelCase.
2. **List endpoints return a wrapper**, never a bare array:
   ```json
   { "items": [ ... ], "total": 42 }
   ```
   `total` = total count of matching items (for MVP without pagination, `total === items.length`). Where pagination is added later, a `page` field will be added — none of the MVP endpoints paginate.
3. **Error shape is uniform** for every non-2xx response:
   ```json
   { "error": { "code": "UNAUTHENTICATED", "message": "Token không hợp lệ hoặc đã hết hạn." } }
   ```
   `code` is a stable SCREAMING_SNAKE string (machine-readable); `message` is a Vietnamese human-readable string for UI display.
4. **Auth**: protected endpoints require header `Authorization: Bearer <jwt>`. Missing/invalid → `401 UNAUTHENTICATED`.
5. **Content-Type**: `application/json` for all request bodies and responses.
6. **Timestamps**: ISO 8601 UTC strings, e.g. `"2026-06-09T08:30:00.000Z"`.
7. **IDs**: opaque strings (cuid).
8. **Base path**: all endpoints prefixed `/api`.

### Standard error codes

| HTTP | code | When |
|------|------|------|
| 400 | `VALIDATION_ERROR` | malformed/invalid body or params |
| 401 | `UNAUTHENTICATED` | missing/invalid/expired token |
| 401 | `INVALID_CREDENTIALS` | wrong email/password on login |
| 403 | `FORBIDDEN` | caller is authenticated but not the resource owner |
| 404 | `NOT_FOUND` | resource (topic/exercise/card) does not exist |
| 409 | `EMAIL_TAKEN` | register with an already-used email |
| 500 | `INTERNAL_ERROR` | unexpected server error |

---

## Shared object shapes

```ts
User        { id: string, email: string, name: string, createdAt: string }
AuthResponse{ token: string, user: User }

TopicSummary{ id: string, slug: string, title: string, titleVi: string,
              description: string | null, flashcardCount: number,
              knownCount: number, completionPercent: number,
              userId: string | null }   // progress is per-authed-user; userId: null = seeded (read-only), non-null = owner-writable (v4)

Flashcard   { id: string, topicId: string, front: string, back: string,
              example: string | null, order: number, known: boolean } // known is per-authed-user

TopicDetail { id: string, slug: string, title: string, titleVi: string,
              description: string | null, flashcardCount: number,
              knownCount: number, completionPercent: number,
              userId: string | null,                                  // (v4) ownership marker, same semantics as TopicSummary.userId
              flashcards: Flashcard[] }

ReadingQuestionPublic { id: string, prompt: string, options: string[], order: number } // NO correctIndex
ReadingQuestionGraded { id: string, prompt: string, options: string[], order: number,
                        correctIndex: number, selectedIndex: number, correct: boolean }

ReadingExerciseSummary{ id: string, slug: string, title: string, level: string,
                        questionCount: number, bestScore: number | null }  // bestScore per-authed-user
ReadingExerciseDetail { id: string, slug: string, title: string, level: string,
                        passage: string, questions: ReadingQuestionPublic[] }

ReadingAttempt        { id: string, exerciseId: string, score: number, total: number,
                        createdAt: string }
ReadingAttemptResult  { id: string, exerciseId: string, score: number, total: number,
                        createdAt: string, questions: ReadingQuestionGraded[] }

// v2 — My Vocabulary. Owner-only; optional string fields are null when unset,
// array fields are always present (never null), default []. cefrLevel ∈ {A1,A2,B1,B2,C1,C2} | null.
VocabularyEntry { id: string, userId: string, word: string, meaning: string,
                  pronunciation: string | null, partOfSpeech: string | null,
                  synonyms: string[], antonyms: string[],
                  exampleSentence: string | null, notes: string | null,
                  tags: string[], cefrLevel: string | null,
                  isFavorite: boolean, known: boolean,
                  createdAt: string, updatedAt: string }
```

---

# Auth

### POST /api/auth/register
Consumed by: `/register`
Auth: no
Request body:
```json
{ "email": "an@example.com", "password": "secret123", "name": "An Nguyen" }
```
Field types: `email: string` (valid email), `password: string` (min 6), `name: string` (1–80 chars).
Response 201:
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": "ckv1...", "email": "an@example.com", "name": "An Nguyen", "createdAt": "2026-06-09T08:30:00.000Z" }
}
```
Errors: 400 `VALIDATION_ERROR`, 409 `EMAIL_TAKEN`.

---

### POST /api/auth/login
Consumed by: `/login`
Auth: no
Request body:
```json
{ "email": "an@example.com", "password": "secret123" }
```
Response 200:
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": "ckv1...", "email": "an@example.com", "name": "An Nguyen", "createdAt": "2026-06-09T08:30:00.000Z" }
}
```
Errors: 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS`.

---

### GET /api/auth/me
Consumed by: `/` (redirect logic), `app/(app)/layout.tsx` (auth guard), `/dashboard`
Auth: **yes**
Request: none
Response 200:
```json
{ "user": { "id": "ckv1...", "email": "an@example.com", "name": "An Nguyen", "createdAt": "2026-06-09T08:30:00.000Z" } }
```
Errors: 401 `UNAUTHENTICATED`.

---

# Topics & Flashcards

### GET /api/topics
Consumed by: `/topics`
Auth: **yes** (progress fields are per-user)
Request: none (no pagination in MVP)
Response 200 — **list wrapper**:
```json
{
  "items": [
    {
      "id": "tpc_travel",
      "slug": "travel",
      "title": "Travel",
      "titleVi": "Du lịch",
      "description": "Từ vựng chủ đề du lịch",
      "flashcardCount": 20,
      "knownCount": 7,
      "completionPercent": 35
    }
  ],
  "total": 1
}
```
Each item is a `TopicSummary`. `completionPercent` is an integer 0–100. Errors: 401 `UNAUTHENTICATED`.

---

### GET /api/topics/:slug
Consumed by: `/topics/[slug]`
Auth: **yes**
Path param: `slug` (Topic.slug)
Request: none
Response 200 — `TopicDetail` (single object, NOT wrapped):
```json
{
  "id": "tpc_travel",
  "slug": "travel",
  "title": "Travel",
  "titleVi": "Du lịch",
  "description": "Từ vựng chủ đề du lịch",
  "flashcardCount": 2,
  "knownCount": 1,
  "completionPercent": 50,
  "flashcards": [
    { "id": "fc_1", "topicId": "tpc_travel", "front": "airport", "back": "sân bay",
      "example": "We arrived at the airport early.", "order": 0, "known": true },
    { "id": "fc_2", "topicId": "tpc_travel", "front": "luggage", "back": "hành lý",
      "example": "My luggage is heavy.", "order": 1, "known": false }
  ]
}
```
`flashcards` is a bare array **inside** the object (not a top-level list endpoint, so no wrapper). `known` reflects the authed user. Errors: 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`.

---

### PUT /api/flashcards/:id/progress
Consumed by: `/topics/[slug]` (mark thuộc / chưa thuộc), `/topics/[slug]/review` (SRS review session) *(v3)*
Auth: **yes**
Path param: `id` (Flashcard.id)
Request body:
```json
{ "known": true, "quality": 4 }
```
Field types:
- `known: boolean` (required).
- `quality?: number` *(v3)* — integer in `[0,5]`. **Optional**; default `3` if omitted. Feeds the SM-2 spaced-repetition scheduler server-side to recompute `interval`, `easeFactor`, `repetitions`, and `nextReviewAt` on the (userId, flashcardId) progress row. When omitted, the row is upserted to the given `known` value and SRS fields are still updated using the default quality so the card re-enters the review queue at a sane time.
Behavior: upserts the (userId, flashcardId) progress row. `known` is set from the body; SRS fields (`interval`, `easeFactor`, `repetitions`, `nextReviewAt`) are recomputed via SM-2 from `quality` (treat `known:false` as quality ≤ 2 if `quality` omitted, `known:true` as default 3).
Response 200:
```json
{
  "flashcardId": "fc_1",
  "known": true,
  "updatedAt": "2026-06-09T09:00:00.000Z",
  "nextReviewAt": "2026-06-11T09:00:00.000Z"
}
```
- `nextReviewAt` *(v3)*: ISO 8601 timestamp when this card is next due. `null` is allowed if the scheduler chooses not to queue the card (e.g. quality=5 on a long-mature card per implementation choice), but the default contract is a non-null timestamp.
Errors: 400 `VALIDATION_ERROR` (e.g. `quality` not in 0–5), 401 `UNAUTHENTICATED`, 404 `NOT_FOUND` (card id unknown).

---

### POST /api/topics/:slug/progress/reset
Consumed by: `/topics/[slug]` (reset ôn lại)
Auth: **yes**
Path param: `slug` (Topic.slug)
Request: empty body `{}`
Behavior: sets `known = false` for all the authed user's progress rows on cards in this topic (resets the topic for re-study).
Response 200:
```json
{ "slug": "travel", "resetCount": 7, "knownCount": 0, "completionPercent": 0 }
```
`resetCount` = number of cards flipped to unknown. Errors: 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`.

---

## User-created Topics & Flashcards  *(v4 — Feature 7)*

These endpoints let an authed user create, edit, and delete their **own** topics and the flashcards inside them. They never touch seeded content (`userId === null`): any mutation against a seeded resource by any user → `403 FORBIDDEN`. Ownership check is uniform: `topic.userId === req.user.id`. Non-owner mutations against another user's resource also → `403 FORBIDDEN` (we do NOT 404 here — the resource exists for the system; we just signal a permission boundary).

### POST /api/topics  *(v4)*
Consumed by: `/topics/new`
Auth: **yes**
Request body:
```json
{ "title": "My Travel Words", "titleVi": "Từ vựng du lịch của tôi", "description": "Cá nhân hoá" }
```
Field types:
- `title: string` — trimmed, length 1–80; **required**.
- `titleVi: string` — trimmed, length 1–80; **required**.
- `description?: string` — optional free text (no enforced max in MVP beyond sane DB column size).

Behavior: creates a Topic owned by the authed user (`userId = req.user.id`). `slug` is auto-generated from `title` via slugify (lowercase, ASCII-fold, non-alnum → `-`, collapse repeats, trim `-`); on collision, append numeric suffix starting at `-2` (`travel`, `travel-2`, `travel-3`, …). New topics have `flashcardCount: 0`, `knownCount: 0`, `completionPercent: 0`.

Response 201 — a `TopicSummary` (single object, NOT wrapped):
```json
{
  "id": "tpc_abc123",
  "slug": "my-travel-words",
  "title": "My Travel Words",
  "titleVi": "Từ vựng du lịch của tôi",
  "description": "Cá nhân hoá",
  "flashcardCount": 0,
  "knownCount": 0,
  "completionPercent": 0,
  "userId": "ckv1..."
}
```
Errors: 400 `VALIDATION_ERROR` (missing/empty/oversize title or titleVi), 401 `UNAUTHENTICATED`.

---

### PUT /api/topics/:slug  *(v4)*
Consumed by: `/topics/[slug]/edit`
Auth: **yes**
Path param: `slug` (Topic.slug)
Request body — **patch semantics** (all fields optional; only provided fields are updated):
```json
{ "title": "My Travel Words (v2)", "description": "Cập nhật mô tả" }
```
Field types: `title?: string` (1–80), `titleVi?: string` (1–80), `description?: string` (may be `null` to clear). If a field is **absent** from the body it is left untouched; if it is present, the provided value replaces the stored value. **`slug` is not editable in v4** (would invalidate frontend route caches; deferred).

Behavior: owner-only — load topic by slug; if `topic.userId === null` (seeded) OR `topic.userId !== req.user.id` → `403 FORBIDDEN`. Otherwise patch and recompute `updatedAt`.

Response 200 — the updated `TopicSummary` (single object, with refreshed `flashcardCount`/`knownCount`/`completionPercent`):
```json
{
  "id": "tpc_abc123",
  "slug": "my-travel-words",
  "title": "My Travel Words (v2)",
  "titleVi": "Từ vựng du lịch của tôi",
  "description": "Cập nhật mô tả",
  "flashcardCount": 4,
  "knownCount": 1,
  "completionPercent": 25,
  "userId": "ckv1..."
}
```
Errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN` (seeded topic OR another user's topic), 404 `NOT_FOUND` (slug unknown).

---

### DELETE /api/topics/:slug  *(v4)*
Consumed by: `/topics/[slug]/edit` (delete button)
Auth: **yes**
Path param: `slug` (Topic.slug)
Request: empty body.

Behavior: owner-only — same check as PUT (`userId === null` OR `userId !== req.user.id` → `403 FORBIDDEN`). Cascade order (single transaction):
1. delete all `FlashcardProgress` rows whose `flashcardId` belongs to this topic (across **all** users, not just the owner),
2. delete all `Flashcard` rows in this topic,
3. delete the `Topic` row itself.

Response 200 (parseable JSON body, same convention as `DELETE /api/vocabulary/:id`):
```json
{ "success": true }
```
Errors: 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`.

---

### POST /api/topics/:slug/flashcards  *(v4)*
Consumed by: `/topics/[slug]/manage` (add card form)
Auth: **yes**
Path param: `slug` (Topic.slug — must be a user-created topic the caller owns)
Request body:
```json
{ "front": "airport", "back": "sân bay", "example": "We arrived at the airport early." }
```
Field types:
- `front: string` — trimmed, non-empty; **required**.
- `back: string` — trimmed, non-empty; **required**.
- `example?: string` — optional; omitted/`null` stored as `null`.

Behavior: owner-only (same 403 rule as PUT /api/topics/:slug). `order` is computed server-side as `max(existing Flashcard.order in topic) + 1`, or `0` if the topic has no cards yet. `known` is always `false` on the response (the creator's progress row is not auto-created; it lazily appears when they mark the card).

Response 201 — a `Flashcard` (single object, NOT wrapped):
```json
{
  "id": "fc_new",
  "topicId": "tpc_abc123",
  "front": "airport",
  "back": "sân bay",
  "example": "We arrived at the airport early.",
  "order": 4,
  "known": false
}
```
Errors: 400 `VALIDATION_ERROR` (empty front/back), 401 `UNAUTHENTICATED`, 403 `FORBIDDEN` (seeded topic OR another user's topic), 404 `NOT_FOUND` (slug unknown).

---

### PUT /api/flashcards/:id  *(v4)*
Consumed by: `/topics/[slug]/manage` (inline edit)
Auth: **yes**
Path param: `id` (Flashcard.id)
Request body — **patch semantics** (all fields optional):
```json
{ "front": "international airport", "example": "The international airport is 30km away." }
```
Field types: `front?: string` (non-empty when provided), `back?: string` (non-empty when provided), `example?: string` (may be `null` to clear). Absent fields are left untouched.

Behavior: load the flashcard → load its parent topic → if `topic.userId === null` OR `topic.userId !== req.user.id` → `403 FORBIDDEN`. Otherwise patch the card. `order`, `topicId`, `id` are immutable in v4.

Response 200 — the updated `Flashcard`:
```json
{
  "id": "fc_new",
  "topicId": "tpc_abc123",
  "front": "international airport",
  "back": "sân bay",
  "example": "The international airport is 30km away.",
  "order": 4,
  "known": false
}
```
`known` reflects the **authed user's** progress row (false if no row), same convention as the rest of the API.
Errors: 400 `VALIDATION_ERROR` (empty front/back when provided), 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND` (card id unknown).

---

### DELETE /api/flashcards/:id  *(v4)*
Consumed by: `/topics/[slug]/manage` (delete button)
Auth: **yes**
Path param: `id` (Flashcard.id)
Request: empty body.

Behavior: owner-only via parent topic (same 403 rule as PUT /api/flashcards/:id). Cascade order (single transaction):
1. delete all `FlashcardProgress` rows for this card (across **all** users),
2. delete the `Flashcard` row.

The parent topic's `order` sequence is NOT re-packed — gaps are fine (the remaining cards keep their existing `order` values; new cards continue from `max+1`).

Response 200:
```json
{ "success": true }
```
Errors: 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`.

---

### GET /api/topics/:slug/review  *(v3)*
Consumed by: `/topics/[slug]/review` (SRS due-cards queue for a topic)
Auth: **yes**
Path param: `slug` (Topic.slug)
Request: none
Behavior: returns the authed user's **due flashcards** for this topic — cards whose `FlashcardProgress.nextReviewAt <= now` **OR** that have no progress row yet (treated as `nextReviewAt IS NULL`, i.e. never reviewed → always due). Order: `nextReviewAt ASC NULLS FIRST` (never-reviewed first, then most-overdue first), then `Flashcard.order ASC` as a stable tiebreaker.
Response 200 — **list wrapper** + `dueCount`:
```json
{
  "items": [
    { "id": "fc_2", "topicId": "tpc_travel", "front": "luggage", "back": "hành lý",
      "example": "My luggage is heavy.", "order": 1, "known": false },
    { "id": "fc_5", "topicId": "tpc_travel", "front": "passport", "back": "hộ chiếu",
      "example": "Show your passport.", "order": 4, "known": false }
  ],
  "total": 2,
  "dueCount": 2
}
```
- `items[*]` use the **same `Flashcard` shape** as in `GET /api/topics/:slug` (no extra SRS fields exposed on the wire — the scheduler is server-internal).
- `total` = number of items in the response (no pagination — all due cards returned).
- `dueCount` = same value as `total`, surfaced as a convenience alias for the "n cards due" badge on `/topics/[slug]` and `/dashboard`. Always present even when 0.
- Empty queue → `{ "items": [], "total": 0, "dueCount": 0 }`.
Errors: 401 `UNAUTHENTICATED`, 404 `NOT_FOUND` (topic slug unknown).

---

# Dashboard

### GET /api/dashboard
Consumed by: `/dashboard`
Auth: **yes**
Request: none
Response 200 (single object; contains nested lists that DO use the `{ items, total }` wrapper):
```json
{
  "totals": {
    "topicCount": 4,
    "flashcardCount": 80,
    "knownCount": 21,
    "overallCompletionPercent": 26,
    "readingAttemptCount": 5
  },
  "topicProgress": {
    "items": [
      { "id": "tpc_travel", "slug": "travel", "title": "Travel", "titleVi": "Du lịch",
        "description": "Từ vựng chủ đề du lịch", "flashcardCount": 20,
        "knownCount": 7, "completionPercent": 35 }
    ],
    "total": 4
  },
  "recentAttempts": {
    "items": [
      { "id": "att_1", "exerciseId": "rex_1", "exerciseSlug": "city-life",
        "exerciseTitle": "City Life", "score": 4, "total": 5,
        "createdAt": "2026-06-08T10:00:00.000Z" }
    ],
    "total": 5
  }
}
```
Notes:
- `topicProgress.items[*]` are `TopicSummary` objects (same shape as `GET /api/topics`).
- `recentAttempts.items[*]` extend `ReadingAttempt` with `exerciseSlug` and `exerciseTitle` for direct linking; capped server-side (e.g. latest 5) but `total` = lifetime attempt count.
- `overallCompletionPercent` = round(totals.knownCount / totals.flashcardCount * 100), 0 if no cards.
Errors: 401 `UNAUTHENTICATED`.

---

### GET /api/dashboard/progress-history  *(v3)*
Consumed by: `/dashboard` (progress chart — daily learning activity)
Auth: **yes**
Request — query params:
| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `days` | integer | `7` | window length in days, ending at "today" (server local UTC date). **Allowed values: `7` or `30` only.** Any other value → `400 VALIDATION_ERROR`. |

Behavior: returns a **zero-filled** daily series for the last `days` calendar days (inclusive of today, oldest → newest). For each date, `count` = number of distinct flashcards the authed user marked as `known: true` on that UTC date (one increment per (userId, flashcardId, day); re-marking the same card the same day does not double-count). Days with no activity are emitted with `count: 0` — the series length **always** equals `days`.

Response 200 — **list wrapper**:
```json
{
  "items": [
    { "date": "2026-06-04", "count": 12 },
    { "date": "2026-06-05", "count": 0 },
    { "date": "2026-06-06", "count": 8 },
    { "date": "2026-06-07", "count": 3 },
    { "date": "2026-06-08", "count": 0 },
    { "date": "2026-06-09", "count": 5 },
    { "date": "2026-06-10", "count": 2 }
  ],
  "total": 7
}
```
Field types per item:
- `date: string` — `YYYY-MM-DD` (UTC calendar date, NOT an ISO timestamp).
- `count: integer >= 0`.

`total` = number of items = `days` (always — zero-filled). Items are ordered **oldest first**.

Errors: 401 `UNAUTHENTICATED`, 400 `VALIDATION_ERROR` (invalid `days` — anything other than `7` or `30`, including non-integer).

---

# Reading exercises

### GET /api/reading-exercises
Consumed by: `/reading`
Auth: **yes** (`bestScore` is per-user)
Request: none
Response 200 — **list wrapper**:
```json
{
  "items": [
    { "id": "rex_1", "slug": "city-life", "title": "City Life",
      "level": "beginner", "questionCount": 5, "bestScore": 4 }
  ],
  "total": 1
}
```
Each item is `ReadingExerciseSummary`. `bestScore` = user's highest `score` for the exercise, or `null` if never attempted. Errors: 401 `UNAUTHENTICATED`.

---

### GET /api/reading-exercises/:slug
Consumed by: `/reading/[slug]`
Auth: **yes**
Path param: `slug` (ReadingExercise.slug)
Request: none
Response 200 — `ReadingExerciseDetail` (single object). **`correctIndex` is NOT included** on questions:
```json
{
  "id": "rex_1",
  "slug": "city-life",
  "title": "City Life",
  "level": "beginner",
  "passage": "Living in a big city has many advantages...",
  "questions": [
    { "id": "rq_1", "prompt": "What does the passage mainly discuss?",
      "options": ["City life", "Farming", "Weather", "Sports"], "order": 0 },
    { "id": "rq_2", "prompt": "Which is mentioned as an advantage?",
      "options": ["Quiet", "Jobs", "Clean air", "Cheap rent"], "order": 1 }
  ]
}
```
Errors: 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`.

---

### POST /api/reading-exercises/:slug/attempts
Consumed by: `/reading/[slug]` (nộp bài)
Auth: **yes**
Path param: `slug` (ReadingExercise.slug)
Request body — `answers` is an array of selected option indices aligned to question `order` (length must equal questionCount):
```json
{ "answers": [0, 1, 2, 0, 3] }
```
Field types: `answers: number[]` (each `>= 0`, indexes into that question's `options`). `-1` is allowed to mean "unanswered" (counts as incorrect).
Behavior: server grades against stored `correctIndex`, creates an immutable `ReadingAttempt`, returns the result **with per-question grading for review**.
Response 201 — `ReadingAttemptResult`:
```json
{
  "id": "att_9",
  "exerciseId": "rex_1",
  "score": 4,
  "total": 5,
  "createdAt": "2026-06-09T09:15:00.000Z",
  "questions": [
    { "id": "rq_1", "prompt": "What does the passage mainly discuss?",
      "options": ["City life", "Farming", "Weather", "Sports"], "order": 0,
      "correctIndex": 0, "selectedIndex": 0, "correct": true },
    { "id": "rq_2", "prompt": "Which is mentioned as an advantage?",
      "options": ["Quiet", "Jobs", "Clean air", "Cheap rent"], "order": 1,
      "correctIndex": 1, "selectedIndex": 2, "correct": false }
  ]
}
```
Errors: 400 `VALIDATION_ERROR` (wrong length / out-of-range index), 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`.

---

### GET /api/reading-exercises/:slug/attempts
Consumed by: `/reading/[slug]/history`
Auth: **yes**
Path param: `slug` (ReadingExercise.slug)
Request: none (returns the authed user's attempts for this exercise, newest first)
Response 200 — **list wrapper** of `ReadingAttempt` (summary only, no per-question detail):
```json
{
  "items": [
    { "id": "att_9", "exerciseId": "rex_1", "score": 4, "total": 5,
      "createdAt": "2026-06-09T09:15:00.000Z" },
    { "id": "att_3", "exerciseId": "rex_1", "score": 3, "total": 5,
      "createdAt": "2026-06-07T14:00:00.000Z" }
  ],
  "total": 2
}
```
Errors: 401 `UNAUTHENTICATED`, 404 `NOT_FOUND` (exercise slug unknown).

---

# My Vocabulary  *(v2)*

Personal vocabulary store. **All endpoints require `Authorization: Bearer <jwt>` and operate ONLY on the authed user's own entries.** An entry that exists but belongs to another user is treated as nonexistent → `404 NOT_FOUND` (existence is never leaked). A full `VocabularyEntry` object is returned by create/detail/update; toggles return a minimal `{ id, … }` shape.

> Out of contract scope (CLIENT-ONLY, see `route-map.md`): dictionary auto-fill (`api.dictionaryapi.dev`) and text-to-speech (`SpeechSynthesis`) run entirely in the browser and never touch this backend.

### GET /api/vocabulary
Consumed by: `/vocabulary` (danh sách từ vựng)
Auth: **yes**
Request — query params (all optional):
| Param | Type | Effect |
|-------|------|--------|
| `search` | string | case-insensitive substring match against `word` OR `meaning` |
| `tag` | string | only entries whose `tags[]` contains this exact tag |
| `partOfSpeech` | string | exact match on `partOfSpeech` |
| `favorite` | `"true"`\|`"false"` | filter by `isFavorite` |
| `sort` | string | `"newest"` (default) → `createdAt` desc; `"oldest"` → asc; `"az"` → `word` asc |

Unknown/empty params are ignored (no error). Filters combine with AND.
Response 200 — **list wrapper**:
```json
{
  "items": [
    {
      "id": "voc_1", "userId": "ckv1...", "word": "ubiquitous",
      "meaning": "có mặt khắp nơi", "pronunciation": "/juːˈbɪkwɪtəs/",
      "partOfSpeech": "adjective", "synonyms": ["omnipresent", "pervasive"],
      "antonyms": ["rare"], "exampleSentence": "Smartphones are ubiquitous nowadays.",
      "notes": "ôn lại tuần sau", "tags": ["IELTS", "C1"], "cefrLevel": "C1",
      "isFavorite": true, "known": false,
      "createdAt": "2026-06-09T08:30:00.000Z", "updatedAt": "2026-06-09T08:30:00.000Z"
    }
  ],
  "total": 1
}
```
Each item is a `VocabularyEntry`. `total` = count of items matching the filters (no pagination in MVP). Errors: 401 `UNAUTHENTICATED`.

---

### POST /api/vocabulary
Consumed by: `/vocabulary/new` (form thêm — user may pre-fill via client-side dictionary lookup, but submits a normal JSON body)
Auth: **yes**
Request body — `word` & `meaning` required; everything else optional. Omitted array fields default to `[]`; omitted optional scalars are stored null:
```json
{
  "word": "ubiquitous", "meaning": "có mặt khắp nơi",
  "pronunciation": "/juːˈbɪkwɪtəs/", "partOfSpeech": "adjective",
  "synonyms": ["omnipresent"], "antonyms": ["rare"],
  "exampleSentence": "Smartphones are ubiquitous nowadays.",
  "notes": "ôn lại tuần sau", "tags": ["IELTS"], "cefrLevel": "C1"
}
```
Field types: `word: string` (non-empty), `meaning: string` (non-empty), `pronunciation?: string`, `partOfSpeech?: string`, `synonyms?: string[]`, `antonyms?: string[]`, `exampleSentence?: string`, `notes?: string`, `tags?: string[]`, `cefrLevel?: "A1"|"A2"|"B1"|"B2"|"C1"|"C2"`.
`userId`, `isFavorite` (false), `known` (false), `id`, `createdAt`, `updatedAt` are set server-side and ignored if sent in the body.
Response 201 — the created `VocabularyEntry` (single object, NOT wrapped). Errors: 400 `VALIDATION_ERROR` (empty word/meaning, bad cefrLevel, non-string array element), 401 `UNAUTHENTICATED`.

---

### GET /api/vocabulary/:id
Consumed by: `/vocabulary/[id]/edit` (pre-fill the edit form), `/vocabulary` (optional detail)
Auth: **yes**
Path param: `id` (VocabularyEntry.id)
Request: none
Response 200 — single `VocabularyEntry` (NOT wrapped). Errors: 401 `UNAUTHENTICATED`, 404 `NOT_FOUND` (id unknown **or** owned by another user).

---

### PUT /api/vocabulary/:id
Consumed by: `/vocabulary/[id]/edit` (lưu chỉnh sửa)
Auth: **yes**
Path param: `id` (VocabularyEntry.id)
Request body: full replacement of editable fields — same shape & validation as `POST` (`word`/`meaning` required, optional fields optional). Editable: `word, meaning, pronunciation, partOfSpeech, synonyms, antonyms, exampleSentence, notes, tags, cefrLevel`. `isFavorite`/`known` MAY also be included and will be applied; if omitted they are left unchanged (not reset). `id`, `userId`, `createdAt` are immutable; `updatedAt` is refreshed server-side.
Response 200 — the updated `VocabularyEntry` (single object). Errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`.

---

### DELETE /api/vocabulary/:id
Consumed by: `/vocabulary` (xoá từ trong danh sách)
Auth: **yes**
Path param: `id` (VocabularyEntry.id)
Request: none
Behavior: hard-deletes the owner's entry.
**Response 200** (chosen over 204 so the frontend gets a parseable JSON body): `{ "success": true }`. Errors: 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`.

---

### PUT /api/vocabulary/:id/favorite
Consumed by: `/vocabulary` (toggle ngôi sao yêu thích)
Auth: **yes**
Path param: `id` (VocabularyEntry.id)
Request body:
```json
{ "isFavorite": true }
```
Field types: `isFavorite: boolean` (required). Sets the flag to the given value (idempotent set, not a blind flip).
Response 200:
```json
{ "id": "voc_1", "isFavorite": true }
```
Errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`.

---

### PUT /api/vocabulary/:id/progress
Consumed by: `/vocabulary/study` (flashcard study — mark thuộc / chưa thuộc)
Auth: **yes**
Path param: `id` (VocabularyEntry.id)
Request body:
```json
{ "known": true }
```
Field types: `known: boolean` (required). Mirrors `PUT /api/flashcards/:id/progress` but writes directly to the entry's `known` column (no separate progress table — the entry already has a single owner).
Response 200:
```json
{ "id": "voc_1", "known": true }
```
Errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`.

---

### GET /api/vocabulary/tags
Consumed by: `/vocabulary` (populate the tag filter dropdown)
Auth: **yes**
Request: none
Behavior: returns the distinct union of all tags across the authed user's entries, sorted alphabetically (case-insensitive). Empty set → `{ "items": [], "total": 0 }`.
Response 200 — **list wrapper of strings**:
```json
{ "items": ["C1", "IELTS", "business"], "total": 3 }
```
Errors: 401 `UNAUTHENTICATED`.

---

## Endpoint ↔ screen cross-check (no orphans)

| Endpoint | Consumed by |
|----------|-------------|
| POST /api/auth/register | /register |
| POST /api/auth/login | /login |
| GET /api/auth/me | /, (app) layout, /dashboard |
| GET /api/topics | /topics |
| GET /api/topics/:slug | /topics/[slug] |
| POST /api/topics *(v4)* | /topics/new |
| PUT /api/topics/:slug *(v4)* | /topics/[slug]/edit |
| DELETE /api/topics/:slug *(v4)* | /topics/[slug]/edit |
| POST /api/topics/:slug/flashcards *(v4)* | /topics/[slug]/manage |
| PUT /api/flashcards/:id *(v4)* | /topics/[slug]/manage |
| DELETE /api/flashcards/:id *(v4)* | /topics/[slug]/manage |
| PUT /api/flashcards/:id/progress | /topics/[slug], /topics/[slug]/review *(v3)* |
| POST /api/topics/:slug/progress/reset | /topics/[slug] |
| GET /api/topics/:slug/review *(v3)* | /topics/[slug]/review |
| GET /api/dashboard | /dashboard |
| GET /api/dashboard/progress-history *(v3)* | /dashboard |
| GET /api/reading-exercises | /reading |
| GET /api/reading-exercises/:slug | /reading/[slug] |
| POST /api/reading-exercises/:slug/attempts | /reading/[slug] |
| GET /api/reading-exercises/:slug/attempts | /reading/[slug]/history |
| GET /api/vocabulary *(v2)* | /vocabulary |
| POST /api/vocabulary *(v2)* | /vocabulary/new |
| GET /api/vocabulary/:id *(v2)* | /vocabulary/[id]/edit |
| PUT /api/vocabulary/:id *(v2)* | /vocabulary/[id]/edit |
| DELETE /api/vocabulary/:id *(v2)* | /vocabulary |
| PUT /api/vocabulary/:id/favorite *(v2)* | /vocabulary |
| PUT /api/vocabulary/:id/progress *(v2)* | /vocabulary/study |
| GET /api/vocabulary/tags *(v2)* | /vocabulary |

No async/long-running operations in MVP — all responses are synchronous (no 202 flows).

---

## DIFF — v2 (My Vocabulary)

**New shape:** `VocabularyEntry` (full field list in *Shared object shapes*).

**8 new endpoints** (all `Bearer` auth, owner-scoped, non-owner → `404 NOT_FOUND`):

| Method + path | Request | Success response |
|---------------|---------|------------------|
| `GET /api/vocabulary` | query: `search?, tag?, partOfSpeech?, favorite?, sort?` | 200 `{ items: VocabularyEntry[], total }` |
| `POST /api/vocabulary` | body: word*, meaning*, + optional fields | 201 `VocabularyEntry` |
| `GET /api/vocabulary/:id` | — | 200 `VocabularyEntry` |
| `PUT /api/vocabulary/:id` | body: full editable fields (word*, meaning*) | 200 `VocabularyEntry` |
| `DELETE /api/vocabulary/:id` | — | 200 `{ success: true }` |
| `PUT /api/vocabulary/:id/favorite` | body: `{ isFavorite: boolean }` | 200 `{ id, isFavorite }` |
| `PUT /api/vocabulary/:id/progress` | body: `{ known: boolean }` | 200 `{ id, known }` |
| `GET /api/vocabulary/tags` | — | 200 `{ items: string[], total }` |

**Decisions to honor:** DELETE returns `200 { success: true }` (not 204). Favorite/progress are idempotent SET (value comes from body), not server-side flips. `cefrLevel` validated against `{A1,A2,B1,B2,C1,C2}`. Dictionary auto-fill + TTS are CLIENT-ONLY — no backend endpoints. No existing endpoints changed.

---

## DIFF — v3 (Progress chart + SRS + Reading→Vocabulary)

### Feature 4 — Progress chart (dashboard)
- **New endpoint:** `GET /api/dashboard/progress-history?days=7|30`.
- Response is a **list wrapper** of zero-filled daily buckets: `{ items: [{ date: "YYYY-MM-DD", count: number }, …], total: number }`.
- `total` always equals the `days` param (series is zero-filled, never sparse).
- `date` is a `YYYY-MM-DD` UTC calendar string, NOT an ISO timestamp.
- `count` = number of distinct flashcards the user marked `known:true` on that UTC day (de-duped per (userId, flashcardId, day)).
- Items ordered oldest → newest.
- Errors: `400 VALIDATION_ERROR` if `days` ≠ 7 and ≠ 30; `401 UNAUTHENTICATED`.

### Feature 5 — Spaced Repetition (SRS)
- **Updated endpoint:** `PUT /api/flashcards/:id/progress` now accepts an **optional** `quality: integer 0–5` (default `3` when omitted). Feeds a server-side SM-2 scheduler that recomputes `interval`, `easeFactor`, `repetitions`, `nextReviewAt` on the progress row.
- **Updated response:** the same endpoint now also returns `nextReviewAt: string | null` alongside the existing `flashcardId`, `known`, `updatedAt`. Existing v2 callers that send only `{ "known": boolean }` keep working — they will simply use the default quality and receive the extra `nextReviewAt` field (additive, non-breaking).
- **New endpoint:** `GET /api/topics/:slug/review` returns the authed user's due cards for a topic. Response: `{ items: Flashcard[], total: number, dueCount: number }`. `items` use the same `Flashcard` shape as `GET /api/topics/:slug` (no SRS fields exposed on the wire). `dueCount === total` (alias for the badge). Order: `nextReviewAt ASC NULLS FIRST`, then `Flashcard.order`. Empty queue → `{ items: [], total: 0, dueCount: 0 }`.

### Feature 8 — Reading highlight → Vocabulary
- **No backend changes.** The reading screen captures the selected word client-side and prefills the existing `POST /api/vocabulary` form (or POSTs directly with `word` populated). All other `VocabularyEntry` fields are filled by the user / client-side dictionary lookup exactly as in v2.

### Decisions to honor (v3)
- `quality` is OPTIONAL on `PUT /api/flashcards/:id/progress`. Frontend MAY keep sending the v2 body shape `{ "known": true }` from `/topics/[slug]` and add `quality` only from the SRS review screen — backend must accept both.
- `nextReviewAt` on the progress response is additive; null is permitted but the default contract is a non-null ISO 8601 timestamp.
- `GET /api/topics/:slug/review` returns the **public** `Flashcard` shape; SRS internals (`interval`, `easeFactor`, `repetitions`, `nextReviewAt` on FlashcardProgress) stay server-internal and are NOT serialized into `items[*]`.
- `GET /api/dashboard/progress-history` enforces a strict `days ∈ {7, 30}` allowlist — no arbitrary windows in v3.
- Feature 8 is intentionally client-only — do NOT introduce a new endpoint for it.

---

## DIFF — v4 (User-created Topics & Flashcards — Feature 7)

### Shape changes
- `TopicSummary` and `TopicDetail` both gain `userId: string | null`.
  - `userId === null` → **seeded** topic; **read-only** for everyone (any mutation → `403 FORBIDDEN`).
  - `userId === <some-user-id>` → **user-created** topic; only that user (`req.user.id === topic.userId`) may mutate it or its flashcards.
- `Flashcard` shape unchanged — ownership is derived from its parent topic, not stored on the card.
- All existing GET endpoints (`GET /api/topics`, `GET /api/topics/:slug`, `GET /api/dashboard`) continue to return both seeded and user-created topics; the frontend uses the new `userId` field to decide whether to render edit/delete affordances.

### New standard error code
- `403 FORBIDDEN` — caller is authenticated but is not the resource owner (or the resource is seeded). Use this whenever a user-created-content mutation is attempted by a non-owner or against seeded content. Do NOT 404 on cross-user mutation — 403 makes the permission boundary explicit (matches frontend's need to show "Bạn không có quyền chỉnh sửa topic này"). 404 remains for genuinely-unknown slugs/ids.

### 6 new endpoints (all `Bearer` auth, owner-scoped)

| Method + path | Request | Success response | Owner-only? |
|---------------|---------|------------------|-------------|
| `POST /api/topics` | body: `{ title*, titleVi*, description? }` | 201 `TopicSummary` | — (creates) |
| `PUT /api/topics/:slug` | body: `{ title?, titleVi?, description? }` (patch) | 200 `TopicSummary` | yes — 403 on seeded or non-owner |
| `DELETE /api/topics/:slug` | — | 200 `{ success: true }` | yes — 403 on seeded or non-owner |
| `POST /api/topics/:slug/flashcards` | body: `{ front*, back*, example? }` | 201 `Flashcard` | yes (parent topic) |
| `PUT /api/flashcards/:id` | body: `{ front?, back?, example? }` (patch) | 200 `Flashcard` | yes (parent topic) |
| `DELETE /api/flashcards/:id` | — | 200 `{ success: true }` | yes (parent topic) |

### Decisions to honor (v4)
- **Slug generation is server-side** for `POST /api/topics`: slugify(`title`) + dedup suffix `-2,-3,…` on collision. Slug is **immutable** in v4 (no rename) — frontend caches and bookmarks stay valid.
- **Patch semantics** on both PUT endpoints — absent fields are left untouched; present fields (including `null` for `description`/`example`) overwrite. **Do NOT** require full-object replacement.
- **Cascade deletes are server-side, transactional**, and affect **all users' progress rows** (not just the owner's). Frontend never issues separate cleanup calls.
- **Order is append-only**: new flashcards get `max(existing order) + 1`. Deletes leave gaps — do NOT re-pack. Reordering is out of scope for v4.
- **`POST /api/topics/:slug/flashcards` and the two `/api/flashcards/:id` endpoints route through the parent topic for the ownership check** — there is no per-card owner field.
- **Seeded content is permanently read-only** — even the seeding admin cannot mutate it via the API; seed updates require a re-seed job. This keeps the contract symmetric: `userId === null` ⇒ no mutation, full stop.
- **Existing flashcard endpoints (`PUT /api/flashcards/:id/progress`) are unchanged** — progress is per-user and works the same for seeded and user-created cards. The new owner-write endpoints (`PUT /api/flashcards/:id`, `DELETE /api/flashcards/:id`) sit alongside it and are distinguished by path (`/progress` vs not).
- **Empty topics are valid** — a user may create a topic and never add cards; lists and dashboard handle `flashcardCount: 0` already (existing `completionPercent` formula returns `0` when `flashcardCount === 0`).
