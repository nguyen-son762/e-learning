# API Contract — English Learning App (MVP)

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
              knownCount: number, completionPercent: number }   // progress is per-authed-user

Flashcard   { id: string, topicId: string, front: string, back: string,
              example: string | null, order: number, known: boolean } // known is per-authed-user

TopicDetail { id: string, slug: string, title: string, titleVi: string,
              description: string | null, flashcardCount: number,
              knownCount: number, completionPercent: number,
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
Consumed by: `/topics/[slug]` (mark thuộc / chưa thuộc)
Auth: **yes**
Path param: `id` (Flashcard.id)
Request body:
```json
{ "known": true }
```
Field types: `known: boolean` (required).
Behavior: upserts the (userId, flashcardId) progress row to the given `known` value.
Response 200:
```json
{ "flashcardId": "fc_1", "known": true, "updatedAt": "2026-06-09T09:00:00.000Z" }
```
Errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 404 `NOT_FOUND` (card id unknown).

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
| PUT /api/flashcards/:id/progress | /topics/[slug] |
| POST /api/topics/:slug/progress/reset | /topics/[slug] |
| GET /api/dashboard | /dashboard |
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
