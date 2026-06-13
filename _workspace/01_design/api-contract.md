# API Contract — Multi-Language Learning App (MVP)

> **v7 (2026-06-13): + SRS 4-button rating, Streak & XP gamification, Sentence Mining.**
> - **Feature A — SRS 4-button rating (enhancement to v3 `PUT /api/flashcards/:id/progress`).** The wire `quality` field is **redefined** as a 4-value enum `0 | 1 | 2 | 3` meaning **Again=0, Hard=1, Good=2, Easy=3** (NOT raw SM-2 0–5 anymore). The backend maps these into SM-2 internal quality on the way in: `Again→0, Hard→3, Good→4, Easy→5`. `quality` stays **optional** (default = `2` Good, equivalent to SM-2 `4` — was `3` in v3). This is a **wire-shape breaking change for clients that previously sent quality=4 or 5**; all v6 frontends are migrated in lockstep with v7. The response gains two additive fields: `xpEarned: number` and `newStreak: number`.
> - **Feature B — Streak & XP gamification (NEW).** `User` gains three persisted fields: `streak: number` (consecutive-day study streak, integer ≥ 0), `lastStudiedAt: string | null` (ISO 8601 UTC of last SRS-rating event), `totalXP: number` (lifetime XP, integer ≥ 0), plus a **derived** `badges: Badge[]` (computed from totalXP + streak + activity — see §Gamification rules). These four fields are returned on `GET /api/auth/me`, `POST /api/auth/login`, and `POST /api/auth/register` (always `0/null/0/[]` on register).
>   - **New shape `Badge`:** `{ id: string, label: string, earnedAt: string }` where `id ∈ { "first-review", "week-streak", "century-xp" }`, `label` is a Vietnamese display string, `earnedAt` is the ISO timestamp at which the badge first became eligible (persisted on first detection — once earned, never lost).
>   - **XP accrual rule:** every SRS rating event awards XP — `Again=0, Hard=5, Good=10, Easy=15`. Awarded server-side inside the `PUT /api/flashcards/:id/progress` handler; the response echoes the `xpEarned` for that event AND the resulting `newStreak`.
>   - **Streak rule:** if the user's `lastStudiedAt` is on the previous UTC calendar day → `streak += 1`. If it's the same UTC day → unchanged. Otherwise → `streak = 1` (reset and count today). Streak only advances on a quality ≥ Hard (i.e. ≥ 1 on the 0–3 scale); rating `Again` (0) does NOT advance the streak but DOES update `lastStudiedAt`.
>   - **Built-in badges (server-detected, persisted on first earn):**
>     | id | label (Vietnamese) | trigger |
>     |----|--------------------|---------|
>     | `first-review` | "Đánh giá đầu tiên" | the user's first ever `PUT /api/flashcards/:id/progress` call (any quality, including Again) |
>     | `week-streak` | "7 ngày liên tiếp" | `streak >= 7` for the first time |
>     | `century-xp` | "100 XP" | `totalXP >= 100` for the first time |
>   - **`GET /api/dashboard`** response gains `streak`, `totalXP`, `dueToday: number` (count of the authed user's flashcards — across the resolved language — whose `FlashcardProgress.nextReviewAt <= now()` **OR** that have no progress row yet, scoped to topics in the resolved language), and `badges: Badge[]`. `dueToday` is language-scoped exactly like every other dashboard field *(v6)*.
> - **Feature C — Sentence Mining (NEW endpoint).** `POST /api/vocabulary/mine` — quick-capture from reading: `{ word, exampleSentence, language }` → server auto-finds-or-creates a per-user, per-language Topic `(slug: "__mined__", title: "Mined", titleVi: "Mỏ từ vựng")` owned by the caller and creates a new `VocabularyEntry` with `exampleSentence` set and `language` matching. Returns `201 { item: VocabularyEntry }`. Errors: 400 `VALIDATION_ERROR` if `word` or `exampleSentence` missing/empty. The mined Topic is a regular user-created topic (`userId = req.user.id`) — it shows up in `GET /api/topics` (and the user may rename/delete it like any other), but the auto-create logic always targets the slug `__mined__` for that user+language, so re-mining always lands in the same bucket as long as it exists. If the user deleted the previous `__mined__` topic, a new one is created on the next mining call.
> - **`User` shape changes are additive — all four new fields are non-optional in the response.** Pre-v7 rows backfill to `streak: 0, lastStudiedAt: null, totalXP: 0`. `badges` is derived per-request from `totalXP + streak + persisted earned-badge log` (see `data-model.md` v7 for the persistence shape).
> - **Backward compatibility:** every v6 endpoint still works. Pre-v7 frontends that send `quality ∈ [0,5]` to `PUT /api/flashcards/:id/progress` are **NOT** supported — quality is now strictly `0..3`. Clients should ship v7 frontend + v7 backend together.
> Same conventions (camelCase, `{items,total}` list wrapper, `{error:{code,message}}`, Bearer auth, language gating from v6). See v7 DIFF at end.
>
> **v6 (2026-06-13): + Chinese Learning Module (multi-language).**
> - New enum-like wire value `Language = "en" | "zh"` (lowercase). The app now ships English **and** Mandarin Chinese (Simplified) side by side.
> - `User` gains `language: "en" | "zh" | null` — `null` = not yet chosen → frontend redirects to `/choose-language` after login. Returned on `GET /api/auth/me`, `POST /api/auth/register` (always `null` on register), `POST /api/auth/login` (the stored value, possibly `null`).
> - `TopicSummary`, `TopicDetail`, `ReadingExerciseSummary`, `ReadingExerciseDetail`, `VocabularyEntry` all gain a non-null `language: "en" | "zh"` field. `Flashcard` inherits `language` from its parent `Topic` and is NOT extended (no `language` on the card shape — derive from `topic.language` when needed).
> - `VocabularyEntry` gains `pinyin: string | null` (Hanyu Pinyin with tone marks, e.g. `"nǐ hǎo"`) and `hskLevel: number | null` (integer 1–6). `cefrLevel` is retained but is only meaningful when `language === "en"`; for `language === "zh"` entries it MUST be `null`. Symmetrically, `pinyin`/`hskLevel` MUST be `null` when `language === "en"`.
> - **New endpoint:** `PUT /api/users/me/language { language: "en" | "zh" }` → 200 `{ user: User }`. Sets the caller's `User.language`. Idempotent; switching is allowed at any time.
> - **All list/dashboard read endpoints accept `?language=en|zh`** as an optional query param: `GET /api/topics`, `GET /api/topics/:slug/review`, `GET /api/reading-exercises`, `GET /api/vocabulary`, `GET /api/vocabulary/tags`, `GET /api/dashboard`, `GET /api/dashboard/progress-history`. Default = caller's `user.language` (i.e. server reads the column when the param is absent). If `user.language IS NULL` AND the param is absent → `403 LANGUAGE_NOT_SELECTED`.
> - **Single-resource detail endpoints** (`GET /api/topics/:slug`, `GET /api/reading-exercises/:slug`, `GET /api/vocabulary/:id`) DO NOT gate on `LANGUAGE_NOT_SELECTED` — they return the resource as stored, and the response carries its `language` field so the frontend can render the correct UI variant. (Trying to fetch a `zh` topic while `user.language === "en"` succeeds; the frontend may choose to nudge a switch but the API does not enforce.) **Slug-collision rule *(v6 amendment 2026-06-13)*:** since `(slug, language)` is the unique tuple, the same slug MAY exist in both languages. Resolution order for `:slug` lookups: **(1)** if the caller passed `?language=` explicitly, match `(slug, language)` exactly (404 if not found); **(2)** else if `user.language IS NOT NULL`, prefer the row matching `(slug, user.language)`; **(3)** else fall back to ANY row with that slug (deterministic: order by `createdAt ASC` then `id ASC`, take the first). This keeps deep-links working across language switches AND for unauthenticated/unselected callers, while making the common case (caller's-language match) deterministic. `GET /api/vocabulary/:id` is unaffected (`id` is globally unique). Applies to ALL by-slug operations: read, update, delete, attempt-create, flashcard-create, question-CRUD — owner/admin authz runs AFTER the slug resolves.
> - **All create endpoints** accept `language` in the body: `POST /api/topics`, `POST /api/reading-exercises` (admin), `POST /api/vocabulary`. If `language` is omitted, the server inherits from `user.language` (the user MUST have selected one — `null` → `403 LANGUAGE_NOT_SELECTED`). Server-side slug uniqueness is **scoped per-language** (`travel` may exist for both `en` and `zh`; the (slug, language) tuple is unique).
> - **New error code:** `403 LANGUAGE_NOT_SELECTED` — returned on any protected endpoint that needs an implicit language (list filtering by `user.language`, or create-body inheriting from `user.language`) when `user.language IS NULL`. Frontend MUST treat this as "redirect to `/choose-language`". Endpoints that take an explicit `?language=` query or `language` body field bypass this check.
> - **Vocabulary validation extended:** when `language === "zh"`, `cefrLevel` MUST be `null` (or omitted) and `hskLevel`, if provided, MUST be an integer in `[1,6]`; `pinyin` is an optional string. When `language === "en"`, `pinyin` and `hskLevel` MUST be `null` (or omitted); `cefrLevel` keeps its existing `A1..C2` validation.
> - **Backward-compatible:** every existing endpoint still works. Servers backfill `language = "en"` for all pre-v6 `User`/`Topic`/`ReadingExercise`/`VocabularyEntry` rows in the migration. Frontends that don't yet send `?language=` get filtered by the user's stored language as before (and are gated by `LANGUAGE_NOT_SELECTED` only if the user is fresh post-v6 and hasn't chosen).
> - UI language stays Vietnamese throughout.
> Same conventions (camelCase, `{items,total}` list wrapper, `{error:{code,message}}`, Bearer auth). See v6 DIFF at end.
>
> **v5 (2026-06-11): + Admin Reading Management.**
> - New `Role` (`"USER" | "ADMIN"`) carried on `User`. `GET /api/auth/me` now returns `user.role` so the frontend can guard `/admin/*` routes and conditionally render admin nav.
> - `ReadingExerciseSummary` gains `createdAt: string (ISO)` (additive, sortable on the admin list).
> - 6 new admin endpoints (all require `role === "ADMIN"`; non-admin authed user → `403 FORBIDDEN`):
>   - `POST /api/reading-exercises`
>   - `PUT /api/reading-exercises/:slug`
>   - `DELETE /api/reading-exercises/:slug`
>   - `POST /api/reading-exercises/:slug/questions`
>   - `PUT /api/reading-exercises/:slug/questions/:id`
>   - `DELETE /api/reading-exercises/:slug/questions/:id`
> - New shape `ReadingQuestionAdmin` (includes `correctIndex`) returned by the question-write endpoints — admin-only path; public `ReadingQuestionPublic`/`ReadingExerciseDetail` still exclude `correctIndex`.
> - Existing reading read-endpoints (`GET /api/reading-exercises`, `GET /api/reading-exercises/:slug`) and attempt endpoints (`POST /api/reading-exercises/:slug/attempts`, `GET /api/reading-exercises/:slug/attempts`) are **unchanged**.
> Same conventions (camelCase, `{items,total}` list wrapper, `{error:{code,message}}`, Bearer auth). See v5 DIFF at end.
>
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
| 403 | `FORBIDDEN` | caller is authenticated but lacks authority — not the resource owner (v4) OR not `ADMIN` for an admin-only endpoint (v5) |
| 403 | `LANGUAGE_NOT_SELECTED` | *(v6)* caller's `user.language IS NULL` AND the endpoint needs to default to it (list filtering / create-body inherit). Frontend → redirect `/choose-language`. |
| 404 | `NOT_FOUND` | resource (topic/exercise/card) does not exist |
| 409 | `EMAIL_TAKEN` | register with an already-used email |
| 500 | `INTERNAL_ERROR` | unexpected server error |

---

## Shared object shapes

```ts
// v6 — wire-level enum-like for language selection. Lowercase. Persisted on User, Topic,
// ReadingExercise, VocabularyEntry. Flashcard inherits from its parent Topic (not stored on card).
Language = "en" | "zh"

User        { id: string, email: string, name: string, role: "USER" | "ADMIN",
              language: Language | null,                          // (v6) null = not yet chosen → frontend redirects to /choose-language
              streak: number,                                     // (v7) consecutive-day study streak; integer >= 0; backfill 0 for pre-v7 rows
              lastStudiedAt: string | null,                       // (v7) ISO 8601 of last SRS rating event; null if never reviewed
              totalXP: number,                                    // (v7) lifetime XP; integer >= 0; backfill 0 for pre-v7 rows
              badges: Badge[],                                    // (v7) earned badges (server-detected, persisted); empty array if none earned yet
              createdAt: string }                                 // role added v5
AuthResponse{ token: string, user: User }

// (v7) Gamification badge — server-detected achievement, persisted on first earn (once earned, never lost).
Badge       { id: "first-review" | "week-streak" | "century-xp",
              label: string,                                      // Vietnamese display label, e.g. "Đánh giá đầu tiên"
              earnedAt: string }                                  // ISO 8601 UTC of when this badge was first detected

TopicSummary{ id: string, slug: string, title: string, titleVi: string,
              description: string | null, flashcardCount: number,
              knownCount: number, completionPercent: number,
              userId: string | null,                              // (v4) seeded vs user-created
              language: Language }                                // (v6) "en" | "zh" — content language

Flashcard   { id: string, topicId: string, front: string, back: string,
              example: string | null, order: number, known: boolean } // known is per-authed-user; language inherited from parent topic (NOT on card)

TopicDetail { id: string, slug: string, title: string, titleVi: string,
              description: string | null, flashcardCount: number,
              knownCount: number, completionPercent: number,
              userId: string | null,                              // (v4) ownership marker, same semantics as TopicSummary.userId
              language: Language,                                 // (v6)
              flashcards: Flashcard[] }

ReadingQuestionPublic { id: string, prompt: string, options: string[], order: number } // NO correctIndex
ReadingQuestionGraded { id: string, prompt: string, options: string[], order: number,
                        correctIndex: number, selectedIndex: number, correct: boolean }
ReadingQuestionAdmin  { id: string, exerciseId: string, prompt: string, options: string[],
                        correctIndex: number, order: number, createdAt: string }      // (v5) admin-only — INCLUDES correctIndex

ReadingExerciseSummary{ id: string, slug: string, title: string, level: string,
                        questionCount: number, bestScore: number | null,
                        language: Language,                                            // (v6)
                        createdAt: string }                                            // (v5) createdAt added — additive
ReadingExerciseDetail { id: string, slug: string, title: string, level: string,
                        passage: string, language: Language,                           // (v6)
                        questions: ReadingQuestionPublic[] }

ReadingAttempt        { id: string, exerciseId: string, score: number, total: number,
                        createdAt: string }
ReadingAttemptResult  { id: string, exerciseId: string, score: number, total: number,
                        createdAt: string, questions: ReadingQuestionGraded[] }

// v2 — My Vocabulary. Owner-only; optional string fields are null when unset,
// array fields are always present (never null), default [].
// (v6) language gates the optional level fields:
//   language === "en" → cefrLevel ∈ {A1,A2,B1,B2,C1,C2} | null; pinyin = null; hskLevel = null.
//   language === "zh" → cefrLevel = null; pinyin: string | null (Hanyu Pinyin with tone marks);
//                       hskLevel: integer 1–6 | null.
VocabularyEntry { id: string, userId: string, word: string, meaning: string,
                  pronunciation: string | null, partOfSpeech: string | null,
                  synonyms: string[], antonyms: string[],
                  exampleSentence: string | null, notes: string | null,
                  tags: string[], cefrLevel: string | null,
                  pinyin: string | null,                          // (v6) Chinese only — null when language === "en"
                  hskLevel: number | null,                        // (v6) Chinese only — integer 1–6, null when language === "en"
                  language: Language,                             // (v6)
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
  "user": { "id": "ckv1...", "email": "an@example.com", "name": "An Nguyen",
            "role": "USER", "language": null,
            "streak": 0, "lastStudiedAt": null, "totalXP": 0, "badges": [],
            "createdAt": "2026-06-09T08:30:00.000Z" }
}
```
`role` *(v5)* is always `"USER"` on register — admins are promoted out-of-band (seed/DB). `language` *(v6)* is always `null` on register — the frontend MUST redirect new users to `/choose-language` immediately after auth (handled in the `(app)` shell guard). `streak`, `lastStudiedAt`, `totalXP`, `badges` *(v7)* are always `0, null, 0, []` on register — gamification state starts empty.
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
  "user": { "id": "ckv1...", "email": "an@example.com", "name": "An Nguyen",
            "role": "USER", "language": "en",
            "streak": 5, "lastStudiedAt": "2026-06-12T22:15:00.000Z",
            "totalXP": 120,
            "badges": [
              { "id": "first-review", "label": "Đánh giá đầu tiên", "earnedAt": "2026-06-01T08:30:00.000Z" },
              { "id": "century-xp",  "label": "100 XP",            "earnedAt": "2026-06-10T19:45:00.000Z" }
            ],
            "createdAt": "2026-06-09T08:30:00.000Z" }
}
```
`role` *(v5)* reflects the user's stored role at login time (`"USER"` or `"ADMIN"`). `language` *(v6)* reflects the user's stored language (`"en"`, `"zh"`, or `null` if never chosen). When `null`, frontend MUST redirect to `/choose-language` before letting the user into the `(app)` shell. `streak`, `lastStudiedAt`, `totalXP`, `badges` *(v7)* reflect the user's current gamification state — see §Gamification rules below.
Errors: 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS`.

---

### GET /api/auth/me
Consumed by: `/` (redirect logic), `app/(app)/layout.tsx` (auth guard + admin nav guard + language gate *(v6)*), `/dashboard`, `app/(app)/admin/**` *(v5 — client-side admin route guard)*, `/choose-language` *(v6 — read current selection)*
Auth: **yes**
Request: none
Response 200:
```json
{ "user": { "id": "ckv1...", "email": "an@example.com", "name": "An Nguyen",
            "role": "ADMIN", "language": "zh",
            "streak": 12, "lastStudiedAt": "2026-06-13T03:00:00.000Z",
            "totalXP": 240,
            "badges": [
              { "id": "first-review", "label": "Đánh giá đầu tiên", "earnedAt": "2026-06-01T08:30:00.000Z" },
              { "id": "week-streak", "label": "7 ngày liên tiếp",   "earnedAt": "2026-06-07T19:00:00.000Z" },
              { "id": "century-xp",  "label": "100 XP",             "earnedAt": "2026-06-10T19:45:00.000Z" }
            ],
            "createdAt": "2026-06-09T08:30:00.000Z" } }
```
- `role` *(v5)* — `"USER"` | `"ADMIN"`. The frontend uses this to (a) conditionally render the "Quản trị" nav item in the authed shell, and (b) guard `/admin/*` routes client-side. The backend STILL enforces admin authority on every `/api/reading-exercises` write endpoint — the client guard is UX, not security.
- `language` *(v6)* — `"en"` | `"zh"` | `null`. `null` = user has never picked a learning language. The `(app)` layout MUST redirect to `/choose-language` whenever `language === null` (the user can still hit `/choose-language` even when set, to switch).
- `streak`, `lastStudiedAt`, `totalXP`, `badges` *(v7)* — gamification state. The TopNav uses `streak` + `totalXP` for the always-visible counter; `/dashboard` uses `badges` for the achievements strip. Badges are **language-agnostic** (lifetime across both `en` and `zh`); streak and XP are also language-agnostic (one rating in any language advances the global streak).
Errors: 401 `UNAUTHENTICATED`.

---

### PUT /api/users/me/language  *(v6)*
Consumed by: `/choose-language` (initial pick), `TopNav` language switcher (re-pick at any time)
Auth: **yes**
Request body:
```json
{ "language": "zh" }
```
Field types: `language: "en" | "zh"` — required. Any other value → `400 VALIDATION_ERROR`.
Behavior: sets the caller's `User.language` to the given value. Idempotent (re-setting the same value succeeds). Switching is allowed at any time — the user's existing progress/vocabulary stays intact (it's all language-scoped at the row level), so a subsequent switch back also "restores" the previous-language view automatically.
Response 200 — wraps the updated `User` the same way `GET /api/auth/me` does (gamification fields *(v7)* included):
```json
{
  "user": {
    "id": "ckv1...", "email": "an@example.com", "name": "An Nguyen",
    "role": "USER", "language": "zh",
    "streak": 12, "lastStudiedAt": "2026-06-13T03:00:00.000Z",
    "totalXP": 240, "badges": [
      { "id": "week-streak", "label": "7 ngày liên tiếp", "earnedAt": "2026-06-07T19:00:00.000Z" }
    ],
    "createdAt": "2026-06-09T08:30:00.000Z"
  }
}
```
Errors: 400 `VALIDATION_ERROR` (missing/invalid `language`), 401 `UNAUTHENTICATED`.

> Note: this endpoint NEVER returns `403 LANGUAGE_NOT_SELECTED` — the caller is explicitly setting the field. The `LANGUAGE_NOT_SELECTED` guard kicks in on other protected endpoints that need to *default* from `user.language`.

---

# Topics & Flashcards

### GET /api/topics
Consumed by: `/topics`
Auth: **yes** (progress fields are per-user)
Request — query params (all optional):
| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `language` *(v6)* | `"en"` \| `"zh"` | caller's `user.language` | filter to topics whose `language` matches. If absent AND `user.language IS NULL` → `403 LANGUAGE_NOT_SELECTED`. Any other value → `400 VALIDATION_ERROR`. |

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
      "completionPercent": 35,
      "userId": null,
      "language": "en"
    }
  ],
  "total": 1
}
```
Each item is a `TopicSummary`. `completionPercent` is an integer 0–100. `language` *(v6)* is always present on every item. Errors: 401 `UNAUTHENTICATED`, 400 `VALIDATION_ERROR` *(v6)*, 403 `LANGUAGE_NOT_SELECTED` *(v6)*.

---

### GET /api/topics/:slug
Consumed by: `/topics/[slug]`
Auth: **yes**
Path param: `slug` (Topic.slug)
Request — query params (all optional):
| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `language` *(v6)* | `"en"` \| `"zh"` | (see slug-collision rule above) | OPTIONAL pin to one language. If passed, server matches `(slug, language)` exactly → 404 if not found. If absent, server applies the slug-collision rule (prefer `user.language`, then ANY). NEVER throws `LANGUAGE_NOT_SELECTED` (detail endpoint). |
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
  "userId": null,
  "language": "en",
  "flashcards": [
    { "id": "fc_1", "topicId": "tpc_travel", "front": "airport", "back": "sân bay",
      "example": "We arrived at the airport early.", "order": 0, "known": true },
    { "id": "fc_2", "topicId": "tpc_travel", "front": "luggage", "back": "hành lý",
      "example": "My luggage is heavy.", "order": 1, "known": false }
  ]
}
```
`flashcards` is a bare array **inside** the object (not a top-level list endpoint, so no wrapper). `known` reflects the authed user. `language` *(v6)* indicates the content language — frontend uses it to pick the flashcard UI variant (English-style vs Chinese-style with pinyin/HSK). For `language === "zh"` topics, `flashcards[*].front` is Hán tự (Hanzi) and `back` is "pinyin — nghĩa tiếng Việt" (see `design-spec.md` §3.5). Errors: 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`. **No `LANGUAGE_NOT_SELECTED`** — detail endpoints do not filter by user's language.

---

### PUT /api/flashcards/:id/progress
Consumed by: `/topics/[slug]` (mark thuộc / chưa thuộc), `/topics/[slug]/review` (SRS review session) *(v3)*, `/vocabulary/study` (when mining-topic flashcards are studied)
Auth: **yes**
Path param: `id` (Flashcard.id)
Request body:
```json
{ "known": true, "quality": 2 }
```
Field types:
- `known: boolean` (required).
- `quality?: number` *(v7 — redefined; was v3's 0–5 SM-2)* — integer in `[0,3]` representing the **4-button rating**: `0 = Again, 1 = Hard, 2 = Good, 3 = Easy`. **Optional**; default `2` (Good) if omitted. The backend maps this enum into SM-2 internal quality: `Again→0, Hard→3, Good→4, Easy→5`, then runs SM-2 to recompute `interval`, `easeFactor`, `repetitions`, and `nextReviewAt`. Any value outside `[0,3]` → `400 VALIDATION_ERROR` (this is a **wire-shape breaking change from v3** — v3 callers that sent `quality: 4` or `5` will now fail validation; v7 frontend ships in lockstep).

Behavior: upserts the (userId, flashcardId) progress row. `known` is set from the body; SRS fields (`interval`, `easeFactor`, `repetitions`, `nextReviewAt`) are recomputed via SM-2 from the **mapped** quality. *(v7)* Also: awards XP (`Again=0, Hard=5, Good=10, Easy=15`), advances or resets the user's `streak`, updates `lastStudiedAt = now()`, and detects newly-earned badges. All gamification side-effects happen in the same transaction as the SRS update so the response is consistent.

**Streak update rule *(v7)*:**
- Compute the UTC calendar date of `lastStudiedAt` and of `now()`.
- If the dates are equal → `streak` unchanged.
- Else if `lastStudiedAt` is the previous UTC calendar day → `streak += 1` (advance), **only if `quality >= 1` (Hard or better)**. Rating `Again` (0) updates `lastStudiedAt` but does NOT advance the streak.
- Else → `streak = (quality >= 1 ? 1 : 0)` (reset; today counts only if user rated at least Hard).
- `lastStudiedAt = now()` is always set, regardless of quality.

**XP rule *(v7)*:** `xpEarned = [0, 5, 10, 15][quality]`. `totalXP += xpEarned` atomically.

**Badge detection *(v7)*:** after applying XP and streak updates, check the three triggers (`first-review`, `week-streak`, `century-xp`) — for any that newly fire AND have not been previously earned, persist an `EarnedBadge` row with `earnedAt = now()`. Badges, once earned, are never lost or re-emitted.

Response 200:
```json
{
  "flashcardId": "fc_1",
  "known": true,
  "updatedAt": "2026-06-09T09:00:00.000Z",
  "nextReviewAt": "2026-06-11T09:00:00.000Z",
  "xpEarned": 10,
  "newStreak": 6
}
```
- `nextReviewAt` *(v3)*: ISO 8601 timestamp when this card is next due. `null` is allowed if the scheduler chooses not to queue the card, but the default contract is a non-null timestamp.
- `xpEarned` *(v7)*: integer XP awarded by THIS rating event (`0 | 5 | 10 | 15`). Frontend uses this for the "+X XP" toast / particle effect on the review screen.
- `newStreak` *(v7)*: integer ≥ 0 — the user's streak AFTER this rating is applied. Mirrors `user.streak` after the mutation; surfaced here so the client can update the streak counter without a separate `/me` refetch.

Note: the response does NOT include `badges` — when a badge is newly earned, the frontend detects it by refetching `/api/auth/me` (or by comparing `newStreak`/cumulative XP against thresholds client-side and confirming via `/me`). This keeps the hot-path response small.

Errors: 400 `VALIDATION_ERROR` (`quality` not in `[0,3]`, missing `known`), 401 `UNAUTHENTICATED`, 404 `NOT_FOUND` (card id unknown).

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
{ "title": "My Travel Words", "titleVi": "Từ vựng du lịch của tôi", "description": "Cá nhân hoá", "language": "en" }
```
Field types:
- `title: string` — trimmed, length 1–80; **required**.
- `titleVi: string` — trimmed, length 1–80; **required**.
- `description?: string` — optional free text (no enforced max in MVP beyond sane DB column size).
- `language?: "en" | "zh"` *(v6)* — optional. If omitted, server uses `user.language`; if that is also `null` → `403 LANGUAGE_NOT_SELECTED`. If provided, MUST be `"en"` or `"zh"`.

Behavior: creates a Topic owned by the authed user (`userId = req.user.id`). `slug` is auto-generated from `title` via slugify (lowercase, ASCII-fold, non-alnum → `-`, collapse repeats, trim `-`); on collision **within the same language**, append numeric suffix starting at `-2` (`travel`, `travel-2`, `travel-3`, …). **Slug uniqueness is scoped per-language** *(v6)* — `(slug, language)` is the unique tuple, so an `en` topic and a `zh` topic may both have `slug = "travel"`. New topics have `flashcardCount: 0`, `knownCount: 0`, `completionPercent: 0`, and the resolved `language`.

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
  "userId": "ckv1...",
  "language": "en"
}
```
Errors: 400 `VALIDATION_ERROR` (missing/empty/oversize title or titleVi; invalid `language` value), 401 `UNAUTHENTICATED`, 403 `LANGUAGE_NOT_SELECTED` *(v6 — when body omits `language` and user has not chosen)*.

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
  "userId": "ckv1...",
  "language": "en"
}
```
**Note (v6):** `language` is **immutable** via PUT — it is set at creation and not patchable. Including it in the body is silently ignored (or returns 400 — implementation choice; recommend silent ignore for forward-compat).
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
Request — query params (all optional):
| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `language` *(v6 — list-style endpoint)* | `"en"` \| `"zh"` | caller's `user.language` | resolves which topic to look up under the per-language slug uniqueness. If absent AND `user.language IS NULL` → **`403 LANGUAGE_NOT_SELECTED`** (even though the path has a `:slug`, this endpoint is classified as list-style — it returns a `{items, total, dueCount}` wrapper and is scoped to the user's current language by default). |

Behavior: resolves `(slug, language)` to a single topic (same `:slug` resolution rule as `GET /api/topics/:slug` v6 amendment, except that when `language` is unresolvable a `LANGUAGE_NOT_SELECTED` error is thrown instead of falling back to "ANY" — list-style endpoints are stricter). Returns the authed user's **due flashcards** for this topic — cards whose `FlashcardProgress.nextReviewAt <= now` **OR** that have no progress row yet (treated as `nextReviewAt IS NULL`, i.e. never reviewed → always due). Order: `nextReviewAt ASC NULLS FIRST` (never-reviewed first, then most-overdue first), then `Flashcard.order ASC` as a stable tiebreaker.
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
Errors: 401 `UNAUTHENTICATED`, 404 `NOT_FOUND` (topic slug unknown in resolved language), 400 `VALIDATION_ERROR` *(v6 — invalid `language`)*, 403 `LANGUAGE_NOT_SELECTED` *(v6 — list-style endpoint; user.language null and no query param)*.

---

# Dashboard

### GET /api/dashboard
Consumed by: `/dashboard`
Auth: **yes**
Request — query params (all optional):
| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `language` *(v6)* | `"en"` \| `"zh"` | caller's `user.language` | scopes EVERY field in the response — `totals.*`, `topicProgress.items[*]`, `recentAttempts.items[*]` — to content of that language. If absent AND `user.language IS NULL` → `403 LANGUAGE_NOT_SELECTED`. |

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
  "streak": 12,
  "totalXP": 240,
  "dueToday": 17,
  "badges": [
    { "id": "first-review", "label": "Đánh giá đầu tiên", "earnedAt": "2026-06-01T08:30:00.000Z" },
    { "id": "week-streak", "label": "7 ngày liên tiếp",   "earnedAt": "2026-06-07T19:00:00.000Z" },
    { "id": "century-xp",  "label": "100 XP",             "earnedAt": "2026-06-10T19:45:00.000Z" }
  ],
  "topicProgress": {
    "items": [
      { "id": "tpc_travel", "slug": "travel", "title": "Travel", "titleVi": "Du lịch",
        "description": "Từ vựng chủ đề du lịch", "flashcardCount": 20,
        "knownCount": 7, "completionPercent": 35, "userId": null, "language": "en" }
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
- `topicProgress.items[*]` are `TopicSummary` objects (same shape as `GET /api/topics`), including the `language` field *(v6)* — all items share the resolved language.
- `recentAttempts.items[*]` extend `ReadingAttempt` with `exerciseSlug` and `exerciseTitle` for direct linking; capped server-side (e.g. latest 5) but `total` = lifetime attempt count **within the resolved language** *(v6)*.
- `overallCompletionPercent` = round(totals.knownCount / totals.flashcardCount * 100), 0 if no cards. **Computed only over the resolved language's content** *(v6)*.
- `totals.readingAttemptCount` *(v6)* counts only attempts on exercises of the resolved language.
- `streak`, `totalXP`, `badges` *(v7)* — mirror the user's gamification state (same values as `GET /api/auth/me`). **Language-agnostic** — these are lifetime/global counters that do NOT get scoped by `?language=`. Surfaced here so the dashboard can render the streak/XP card and badge strip without a second `/me` refetch.
- `dueToday: number` *(v7)* — count of flashcards in topics of the **resolved language** whose `FlashcardProgress.nextReviewAt <= now()` **OR** that have no progress row yet (never reviewed = always due). Mirrors the logic in `GET /api/topics/:slug/review` but summed across **all** topics in the resolved language (seeded + user-created). Frontend renders the "n cards due" CTA on the dashboard.
Errors: 401 `UNAUTHENTICATED`, 400 `VALIDATION_ERROR` *(v6 — invalid `language`)*, 403 `LANGUAGE_NOT_SELECTED` *(v6)*.

---

### GET /api/dashboard/progress-history  *(v3)*
Consumed by: `/dashboard` (progress chart — daily learning activity)
Auth: **yes**
Request — query params:
| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `days` | integer | `7` | window length in days, ending at "today" (server local UTC date). **Allowed values: `7` or `30` only.** Any other value → `400 VALIDATION_ERROR`. |
| `language` *(v6)* | `"en"` \| `"zh"` | caller's `user.language` | filters the per-day `count` to flashcards whose parent topic has the resolved `language`. If absent AND `user.language IS NULL` → `403 LANGUAGE_NOT_SELECTED`. |

Behavior: returns a **zero-filled** daily series for the last `days` calendar days (inclusive of today, oldest → newest). For each date, `count` = number of distinct flashcards (whose parent topic matches the resolved language) the authed user marked as `known: true` on that UTC date (one increment per (userId, flashcardId, day); re-marking the same card the same day does not double-count). Days with no activity are emitted with `count: 0` — the series length **always** equals `days`.

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

Errors: 401 `UNAUTHENTICATED`, 400 `VALIDATION_ERROR` (invalid `days` — anything other than `7` or `30`, including non-integer; *(v6)* invalid `language`), 403 `LANGUAGE_NOT_SELECTED` *(v6)*.

---

# Reading exercises

### GET /api/reading-exercises
Consumed by: `/reading`, `/admin/reading` *(v5 — admin list view)*
Auth: **yes** (`bestScore` is per-user)
Request — query params (all optional):
| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `language` *(v6)* | `"en"` \| `"zh"` | caller's `user.language` | filter to exercises whose `language` matches. If absent AND `user.language IS NULL` → `403 LANGUAGE_NOT_SELECTED`. **Special-case for `/admin/reading`:** admin may pass `language=all` to see every exercise across languages — server treats `all` as "no filter" only when caller has `role === "ADMIN"`; for non-admins, `all` → `400 VALIDATION_ERROR`. |

Response 200 — **list wrapper**:
```json
{
  "items": [
    { "id": "rex_1", "slug": "city-life", "title": "City Life",
      "level": "beginner", "questionCount": 5, "bestScore": 4,
      "language": "en",
      "createdAt": "2026-06-01T08:00:00.000Z" }
  ],
  "total": 1
}
```
Each item is `ReadingExerciseSummary`. `bestScore` = user's highest `score` for the exercise, or `null` if never attempted. `createdAt` *(v5 — additive)* is the ISO 8601 creation timestamp; admin list sorts by `createdAt DESC` by default. `language` *(v6)* is always present on every item. Errors: 401 `UNAUTHENTICATED`, 400 `VALIDATION_ERROR` *(v6)*, 403 `LANGUAGE_NOT_SELECTED` *(v6)*.

---

### GET /api/reading-exercises/:slug
Consumed by: `/reading/[slug]`
Auth: **yes**
Path param: `slug` (ReadingExercise.slug)
Request — query params (all optional):
| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `language` *(v6)* | `"en"` \| `"zh"` | (see slug-collision rule in v6 banner) | OPTIONAL pin. Same resolution rule as `GET /api/topics/:slug`: explicit pin → exact `(slug, language)` match; absent → prefer `user.language`, then ANY. NEVER throws `LANGUAGE_NOT_SELECTED`. |
Response 200 — `ReadingExerciseDetail` (single object). **`correctIndex` is NOT included** on questions:
```json
{
  "id": "rex_1",
  "slug": "city-life",
  "title": "City Life",
  "level": "beginner",
  "language": "en",
  "passage": "Living in a big city has many advantages...",
  "questions": [
    { "id": "rq_1", "prompt": "What does the passage mainly discuss?",
      "options": ["City life", "Farming", "Weather", "Sports"], "order": 0 },
    { "id": "rq_2", "prompt": "Which is mentioned as an advantage?",
      "options": ["Quiet", "Jobs", "Clean air", "Cheap rent"], "order": 1 }
  ]
}
```
`language` *(v6)* lets the frontend pick the right rendering (English passage vs Chinese — Chinese passages render with `font-family` favoring Hán tự + `lang="zh-CN"` for screen-readers/TTS). **Slug uniqueness is scoped per-language** *(v6)* — `(slug, language)` is the unique tuple. **No `LANGUAGE_NOT_SELECTED`** — detail endpoints do not filter by user's language. Errors: 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`.

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
| `search` | string | case-insensitive substring match against `word` OR `meaning` (also matches `pinyin` when entry `language === "zh"`) *(v6)* |
| `tag` | string | only entries whose `tags[]` contains this exact tag |
| `partOfSpeech` | string | exact match on `partOfSpeech` |
| `favorite` | `"true"`\|`"false"` | filter by `isFavorite` |
| `sort` | string | `"newest"` (default) → `createdAt` desc; `"oldest"` → asc; `"az"` → `word` asc |
| `language` *(v6)* | `"en"` \| `"zh"` | filter to entries whose `language` matches. Default = caller's `user.language`. If absent AND `user.language IS NULL` → `403 LANGUAGE_NOT_SELECTED`. |
| `hskLevel` *(v6)* | integer 1–6 | only entries with this exact `hskLevel` (most useful when `language=zh`) |
| `cefrLevel` *(v6)* | `A1..C2` | only entries with this exact `cefrLevel` (most useful when `language=en`) |

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
      "pinyin": null, "hskLevel": null, "language": "en",
      "isFavorite": true, "known": false,
      "createdAt": "2026-06-09T08:30:00.000Z", "updatedAt": "2026-06-09T08:30:00.000Z"
    },
    {
      "id": "voc_2", "userId": "ckv1...", "word": "你好",
      "meaning": "xin chào", "pronunciation": null,
      "partOfSpeech": "interjection", "synonyms": [], "antonyms": [],
      "exampleSentence": "你好，我叫小明。", "notes": null,
      "tags": ["HSK1", "chào hỏi"], "cefrLevel": null,
      "pinyin": "nǐ hǎo", "hskLevel": 1, "language": "zh",
      "isFavorite": false, "known": false,
      "createdAt": "2026-06-13T08:30:00.000Z", "updatedAt": "2026-06-13T08:30:00.000Z"
    }
  ],
  "total": 2
}
```
Each item is a `VocabularyEntry`. `total` = count of items matching the filters (no pagination in MVP). Errors: 401 `UNAUTHENTICATED`, 400 `VALIDATION_ERROR` *(v6 — invalid language/hskLevel/cefrLevel)*, 403 `LANGUAGE_NOT_SELECTED` *(v6)*.

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
  "notes": "ôn lại tuần sau", "tags": ["IELTS"], "cefrLevel": "C1",
  "language": "en"
}
```
Chinese example body:
```json
{
  "word": "你好", "meaning": "xin chào",
  "pinyin": "nǐ hǎo", "hskLevel": 1,
  "exampleSentence": "你好，我叫小明。",
  "tags": ["HSK1", "chào hỏi"],
  "language": "zh"
}
```
Field types: `word: string` (non-empty), `meaning: string` (non-empty), `pronunciation?: string`, `partOfSpeech?: string`, `synonyms?: string[]`, `antonyms?: string[]`, `exampleSentence?: string`, `notes?: string`, `tags?: string[]`, `cefrLevel?: "A1"|"A2"|"B1"|"B2"|"C1"|"C2"`, **`pinyin?: string`** *(v6)*, **`hskLevel?: number`** *(v6 — integer 1–6)*, **`language?: "en"|"zh"`** *(v6)*.

`language` *(v6)*: if omitted, server uses `user.language`; if that is also `null` → `403 LANGUAGE_NOT_SELECTED`. The resolved `language` then drives cross-field validation:
- `language === "en"` → `pinyin` and `hskLevel` MUST be omitted/null; `cefrLevel` may be set.
- `language === "zh"` → `cefrLevel` MUST be omitted/null; `pinyin` and `hskLevel` are optional. If provided, `hskLevel` MUST be an integer in `[1,6]`.

Any cross-field violation → `400 VALIDATION_ERROR` with a clear `message` (e.g. "Trường `cefrLevel` không áp dụng cho tiếng Trung — dùng `hskLevel`.").

`userId`, `isFavorite` (false), `known` (false), `id`, `createdAt`, `updatedAt` are set server-side and ignored if sent in the body.
Response 201 — the created `VocabularyEntry` (single object, NOT wrapped). Errors: 400 `VALIDATION_ERROR` (empty word/meaning, bad cefrLevel/hskLevel, non-string array element, cross-field mismatch), 401 `UNAUTHENTICATED`, 403 `LANGUAGE_NOT_SELECTED` *(v6)*.

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
Request body: full replacement of editable fields — same shape & validation as `POST` (`word`/`meaning` required, optional fields optional). Editable: `word, meaning, pronunciation, partOfSpeech, synonyms, antonyms, exampleSentence, notes, tags, cefrLevel, pinyin` *(v6)*, `hskLevel` *(v6)*. `isFavorite`/`known` MAY also be included and will be applied; if omitted they are left unchanged (not reset). `id`, `userId`, `createdAt`, **`language`** *(v6 — immutable; switching an entry's language is a delete-and-recreate operation, not a PUT)* are immutable; `updatedAt` is refreshed server-side.

Cross-field validation *(v6)* uses the entry's stored `language`: an `en` entry cannot acquire `pinyin`/`hskLevel`; a `zh` entry cannot acquire `cefrLevel`. Violation → `400 VALIDATION_ERROR`.

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
Request — query params (all optional):
| Param | Type | Default | Effect |
|-------|------|---------|--------|
| `language` *(v6)* | `"en"` \| `"zh"` | caller's `user.language` | scope the tag union to entries of this language. If absent AND `user.language IS NULL` → `403 LANGUAGE_NOT_SELECTED`. |

Behavior: returns the distinct union of all tags across the authed user's entries **of the resolved language**, sorted alphabetically (case-insensitive). Empty set → `{ "items": [], "total": 0 }`.
Response 200 — **list wrapper of strings**:
```json
{ "items": ["C1", "IELTS", "business"], "total": 3 }
```
Errors: 401 `UNAUTHENTICATED`, 400 `VALIDATION_ERROR` *(v6)*, 403 `LANGUAGE_NOT_SELECTED` *(v6)*.

---

### POST /api/vocabulary/mine  *(v7 — Sentence Mining)*
Consumed by: `/reading/[slug]` (highlight-to-mine action button in the passage selection toolbar)
Auth: **yes**
Request body:
```json
{ "word": "ubiquitous", "exampleSentence": "Smartphones are ubiquitous nowadays.", "language": "en" }
```
Field types:
- `word: string` — trimmed, non-empty; **required**.
- `exampleSentence: string` — trimmed, non-empty; **required** (this is the differentiator from `POST /api/vocabulary` — mining always carries the source sentence).
- `language: "en" | "zh"` — **required** (no inherit-from-user-language shortcut here — the reading screen always knows which language it's mining from; explicit is safer than implicit for this hot-path).

Behavior:
1. Resolve (or create) the caller's per-language **mined-topic bucket**: find the Topic with `userId = req.user.id AND slug = "__mined__" AND language = <body.language>`. If absent, create it with `{ slug: "__mined__", title: "Mined", titleVi: "Mỏ từ vựng", description: null, userId: req.user.id, language: body.language }`.
2. Create a new `VocabularyEntry` owned by the caller with `word`, `exampleSentence`, `language` from the body. All other vocabulary fields default to their normal values (`meaning = ""` empty string — the user may edit later from `/vocabulary/[id]/edit`; arrays default `[]`; flags default `false`; `pinyin`/`hskLevel`/`cefrLevel` all `null` since they're optional on mine). The entry is NOT associated with the mined-topic via a hard FK (vocabulary entries are not linked to topics in v6 — the topic exists for surfacing in `GET /api/topics` so the user can see they have mined items, but the entry lives in `VocabularyEntry` and shows up in `GET /api/vocabulary` as normal).
3. Both the topic upsert and the entry create run in a single transaction. If the topic already existed, only the entry is created.

Response 201 — **wraps the created entry in `{ item }`** (this differs from `POST /api/vocabulary` which returns the bare entry — the wrap is a deliberate v7 choice so the frontend hook can distinguish the mining create from regular create at the type level and emit a different toast):
```json
{
  "item": {
    "id": "voc_mined_1", "userId": "ckv1...", "word": "ubiquitous",
    "meaning": "",
    "pronunciation": null, "partOfSpeech": null,
    "synonyms": [], "antonyms": [],
    "exampleSentence": "Smartphones are ubiquitous nowadays.",
    "notes": null, "tags": [],
    "cefrLevel": null, "pinyin": null, "hskLevel": null,
    "language": "en",
    "isFavorite": false, "known": false,
    "createdAt": "2026-06-13T10:00:00.000Z", "updatedAt": "2026-06-13T10:00:00.000Z"
  }
}
```
Notes:
- `meaning` is intentionally **empty string** (not null) on mine — the schema requires `meaning` to be non-null, so mining seeds it empty and the user fills it later. The frontend MUST surface a "thêm nghĩa" call-to-action on the mined entry in `/vocabulary`.
- The mined-topic (`slug: "__mined__"`) is a regular user-created Topic — it shows up in `GET /api/topics` and is fully editable/deletable like any other. If the user deletes it, the next mine call recreates it.
- This endpoint does NOT touch the v7 SRS/XP/streak/badges pipeline — mining is a passive capture, not an active study event. XP is awarded only on `PUT /api/flashcards/:id/progress`.

Errors: 400 `VALIDATION_ERROR` (missing/empty `word`, missing/empty `exampleSentence`, invalid `language`), 401 `UNAUTHENTICATED`.

---

## Gamification rules  *(v7)*

Centralized reference for backend (so streak/XP/badge logic stays consistent across endpoints) and frontend (so client-side optimistic updates stay in sync with the server).

### XP scoring

| Rating wire value | Label (VN) | xpEarned | SM-2 mapped quality |
|-------------------|-----------|----------|---------------------|
| `0` | "Quên" (Again) | 0 | 0 |
| `1` | "Khó" (Hard)   | 5 | 3 |
| `2` | "Tốt" (Good)   | 10 | 4 |
| `3` | "Dễ" (Easy)    | 15 | 5 |

### Streak machine

Triggered on every `PUT /api/flashcards/:id/progress` (NOT on `PUT /api/vocabulary/:id/progress` — v7 only wires streak to flashcard SRS ratings):

```
prev = user.lastStudiedAt   (ISO; may be null)
prevDate = UTC calendar date of prev (or null)
nowDate  = UTC calendar date of now()

if prevDate == nowDate:               streak unchanged
elif prevDate == nowDate - 1 day:     streak += 1   (only if quality >= 1; Again does not advance)
else:                                  streak = (quality >= 1 ? 1 : 0)

user.lastStudiedAt = now()            (always, even for quality=0)
user.totalXP += xpEarned
```

### Badge triggers (server-side, idempotent — once earned, persisted forever)

| id | Trigger (evaluated after streak + XP update) |
|----|----------------------------------------------|
| `first-review` | the user's FIRST EVER `PUT /api/flashcards/:id/progress` (any quality, even Again). Detection: if no EarnedBadge row with `id="first-review"` exists for this user → create. |
| `week-streak` | `user.streak >= 7` AND no EarnedBadge row with `id="week-streak"` → create. |
| `century-xp` | `user.totalXP >= 100` AND no EarnedBadge row with `id="century-xp"` → create. |

Labels (Vietnamese, server-side constant — keep here so frontend doesn't fork the strings):
- `first-review` → `"Đánh giá đầu tiên"`
- `week-streak` → `"7 ngày liên tiếp"`
- `century-xp` → `"100 XP"`

### Language scope

Gamification fields (`streak`, `totalXP`, `badges`) are **language-agnostic** — a rating in `en` and a rating in `zh` both count toward the same streak. This is intentional: the v7 feature brief models gamification as a learner-level habit, not a per-language ladder. Future v8 may introduce per-language streaks if needed.

`dueToday` on `GET /api/dashboard` *(v7)* IS language-scoped (same `?language=` resolution as the rest of the dashboard) — it's a "what should I review next in my current language" CTA, not a global counter.

---

## Endpoint ↔ screen cross-check (no orphans)

| Endpoint | Consumed by |
|----------|-------------|
| POST /api/auth/register | /register |
| POST /api/auth/login | /login |
| GET /api/auth/me | /, (app) layout, /dashboard, /choose-language *(v6)* |
| PUT /api/users/me/language *(v6)* | /choose-language, TopNav language switcher |
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
| POST /api/vocabulary/mine *(v7)* | /reading/[slug] (highlight-to-mine action) |

No async/long-running operations in MVP — all responses are synchronous (no 202 flows).

---

## DIFF — v7 (SRS 4-button rating, Streak & XP gamification, Sentence Mining)

### Shape changes

- **`User`** gains four fields (all non-optional in the response):
  - `streak: number` — integer ≥ 0; default `0` on register; backfill `0` for pre-v7 rows.
  - `lastStudiedAt: string | null` — ISO 8601 UTC; default `null` on register; backfill `null` for pre-v7 rows.
  - `totalXP: number` — integer ≥ 0; default `0` on register; backfill `0` for pre-v7 rows.
  - `badges: Badge[]` — array (may be empty); derived per-request from `EarnedBadge` rows for this user (see `data-model.md` v7).

- **New shape `Badge`** — `{ id: "first-review" | "week-streak" | "century-xp", label: string, earnedAt: string }`. Labels are Vietnamese, frozen by the server.

### Endpoint changes

| Endpoint | Change |
|----------|--------|
| `POST /api/auth/register` | response `user` now includes `streak, lastStudiedAt, totalXP, badges` (always `0, null, 0, []`) |
| `POST /api/auth/login` | response `user` includes the four gamification fields (current values) |
| `GET /api/auth/me` | response `user` includes the four gamification fields |
| `PUT /api/users/me/language` | response `user` includes the four gamification fields (additive — pre-existing endpoint, no behavior change) |
| `PUT /api/flashcards/:id/progress` | **`quality` redefined** as `0..3` (Again/Hard/Good/Easy) — NOT `0..5` SM-2 anymore. Backend maps `0→0, 1→3, 2→4, 3→5` internally. Default `quality` is now `2` (Good). Response gains `xpEarned: number` and `newStreak: number`. **Wire-breaking for v3–v6 clients that sent `quality > 3`.** |
| `GET /api/dashboard` | response gains `streak, totalXP, badges` (language-agnostic) and `dueToday: number` (language-scoped — same `?language=` resolution as the rest of the dashboard) |

### New endpoint

| Method + path | Request | Success response |
|---------------|---------|------------------|
| `POST /api/vocabulary/mine` | body: `{ word, exampleSentence, language }` | 201 `{ item: VocabularyEntry }` |

### Decisions to honor (v7)

- **`quality` is now a 4-button enum, not raw SM-2.** Anything outside `[0,3]` → `400 VALIDATION_ERROR`. The mapping `Again→0, Hard→3, Good→4, Easy→5` happens **inside** the SRS scheduler — the wire never sees SM-2 internal numbers.
- **XP awards are deterministic and server-computed.** Clients NEVER send `xpEarned`; they only read the value off the response. This avoids drift and exploit ("send xpEarned=99999"). The mapping `[0, 5, 10, 15][quality]` lives in `data-model.md` v7 + this section.
- **Streak advances only on `quality >= 1`** (Hard/Good/Easy). Rating `Again` (0) updates `lastStudiedAt` and may break the streak (if `prevDate < yesterday`) but never advances it. This prevents users from gaming the streak by spamming `Again` on a single card.
- **Streak rule operates on UTC calendar dates**, not on rolling 24-hour windows. Consistent with `GET /api/dashboard/progress-history` (also UTC dates).
- **`lastStudiedAt` always updates**, even on `quality = 0` — so the streak machine in the next request has the right "prev day" boundary.
- **Badges are persisted in a separate `EarnedBadge` table**, NOT denormalized into `User`. `User.badges` on the wire is derived per-request via a `findMany({ where: { userId } })`. This keeps the badge log immutable and auditable, and the `user.badges` payload stays small (≤ 3 rows in v7).
- **Badges are language-agnostic, lifetime-cumulative, never lost** — once earned, never removed. New badges in future versions go through the same EarnedBadge table.
- **`dueToday` on the dashboard is language-scoped**, even though `streak/totalXP/badges` are NOT. Rationale: `dueToday` is a "what to review next" CTA — it MUST point to cards the user can actually study right now in their current language. `streak/totalXP/badges` are habit metrics that span both languages.
- **The progress response does NOT include `badges`.** Frontend refetches `/api/auth/me` after a rating event if it suspects a new badge was earned (e.g. crossing the 100-XP threshold, hitting the 7-day mark). This keeps the hot-path response slim — the rating loop in `/topics/[slug]/review` runs N times per session.
- **Sentence mining auto-creates a per-user, per-language Topic with slug `__mined__`.** The slug is reserved — frontend MUST NOT let users create a regular topic with that slug. If the user deletes the mined-topic, the next mine call recreates it cleanly. Mining does NOT touch flashcards (no automatic Flashcard creation in v7 — the entry lives only in `VocabularyEntry`); the topic exists for surfacing the bucket in `GET /api/topics`.
- **`POST /api/vocabulary/mine` wraps its response in `{ item }`** while `POST /api/vocabulary` returns a bare entry. This is intentional — the wrap is a type-level discriminator for the frontend hook so the "mined" toast can be triggered without sniffing call sites. Future v8 may unify these.
- **`POST /api/vocabulary/mine` does NOT inherit `language` from `user.language`** — `language` is REQUIRED in the body. The mining context (reading screen) already knows its language; making it explicit eliminates a class of "mined into wrong bucket on cross-language read" bugs.
- **`meaning` is seeded to empty string on mine**, not null. The DB column stays `NOT NULL` (no schema change). Frontend MUST nudge the user to fill `meaning` from `/vocabulary` (e.g. visual badge on entries with `meaning === ""`).
- **No async / 202 flows** — every v7 endpoint stays synchronous (XP/streak/badge update is in the same DB transaction as the SRS update).
- **JWT does NOT embed gamification fields** — they change too often. Frontend reads them off `/api/auth/me` on shell mount and updates `streak`/`totalXP` optimistically from progress responses; full refetch on suspected badge earn.

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

---

## DIFF — v5 (Admin Reading Management)

### Shape changes
- `User` gains `role: "USER" | "ADMIN"` — surfaced on `GET /api/auth/me` (auth register/login responses include it too, always `"USER"` on register).
- `ReadingExerciseSummary` gains `createdAt: string (ISO)` (additive — admin list sorts by it).
- New admin-only shape `ReadingQuestionAdmin` — same fields as `ReadingQuestionPublic` but INCLUDES `correctIndex`, `exerciseId`, `createdAt`. Returned only by the admin question-write endpoints; the public detail endpoint still returns `ReadingQuestionPublic` (no `correctIndex` leak).

### New standard error code
- `403 FORBIDDEN` reused — caller is authenticated but not `ADMIN` on an admin-only endpoint. Same code used for v4 ownership boundary; the `message` clarifies the variant in Vietnamese.

### 6 new endpoints (all `Bearer` + admin-only — non-`ADMIN` → `403 FORBIDDEN`)

| Method + path | Request | Success response |
|---------------|---------|------------------|
| `POST /api/reading-exercises` | body: `{ slug, title, level, passage }` | 201 `ReadingExerciseSummary` |
| `PUT /api/reading-exercises/:slug` | body: `{ title?, level?, passage? }` (patch) | 200 `ReadingExerciseSummary` |
| `DELETE /api/reading-exercises/:slug` | — | 200 `{ success: true }` |
| `POST /api/reading-exercises/:slug/questions` | body: `{ prompt, options, correctIndex, order? }` | 201 `ReadingQuestionAdmin` |
| `PUT /api/reading-exercises/:slug/questions/:id` | body: patch over question fields | 200 `ReadingQuestionAdmin` |
| `DELETE /api/reading-exercises/:slug/questions/:id` | — | 200 `{ success: true }` |

### Decisions to honor (v5)
- Promotion to `ADMIN` is **out of band** (seed script / DB update). No self-service endpoint.
- Admins do NOT bypass v4 ownership on other users' topics/flashcards/vocabulary — admin authority covers reading content only.
- `correctIndex` continues to be excluded from the public `ReadingExerciseDetail`; the admin question shapes are the only path where it appears, gated by the admin middleware.
- JWT MAY embed `role` to skip a DB read; if the claim is missing (old token) treat as `USER` and force re-login.

---

## DIFF — v6 (Multi-Language: Chinese Learning Module)

### Shape changes
- **New wire enum-like:** `Language = "en" | "zh"` (lowercase strings; not a TS enum at the wire — just two allowed string literals).
- **`User`** gains `language: "en" | "zh" | null`. `null` = not yet chosen; forces frontend to redirect to `/choose-language`. Always `null` on register; always echoed on login + `/api/auth/me`.
- **`TopicSummary`, `TopicDetail`, `ReadingExerciseSummary`, `ReadingExerciseDetail`** all gain a **non-null** `language: "en" | "zh"` field. Always present on every response.
- **`Flashcard`** does NOT gain a `language` field — language is derived from the parent topic (no per-card storage; saves a column and keeps the card shape stable).
- **`VocabularyEntry`** gains:
  - `language: "en" | "zh"` (non-null, immutable after creation)
  - `pinyin: string | null` — Hanyu Pinyin with tone marks, e.g. `"nǐ hǎo"`; null when `language === "en"`
  - `hskLevel: number | null` — integer 1–6; null when `language === "en"`
  - `cefrLevel` retained; null when `language === "zh"`
- **Slug uniqueness scoped per-language** for `Topic` and `ReadingExercise`: the unique tuple is `(slug, language)` — `travel` may exist as both `en` and `zh`.

### New endpoint

| Method + path | Request | Success response |
|---------------|---------|------------------|
| `PUT /api/users/me/language` | body: `{ language: "en" \| "zh" }` | 200 `{ user: User }` |

### Modified endpoints (additive — backward-compatible)

| Endpoint | Change |
|----------|--------|
| `POST /api/auth/register` | response `user` includes `language` (always `null`) |
| `POST /api/auth/login` | response `user` includes `language` (the stored value, possibly `null`) |
| `GET /api/auth/me` | response `user` includes `language` |
| `GET /api/topics` | accepts `?language=en\|zh`; items include `language`; defaults to `user.language`; missing default → `403 LANGUAGE_NOT_SELECTED` |
| `GET /api/topics/:slug` | response includes `language` (no language filter on detail) |
| `POST /api/topics` | body accepts optional `language` (inherits from user); response includes `language` |
| `PUT /api/topics/:slug` | `language` is immutable (silently ignored if present in body); response includes `language` |
| `GET /api/topics/:slug/review` | inherits topic's language; no filter needed; items use unchanged `Flashcard` shape |
| `GET /api/dashboard` | accepts `?language=en\|zh`; **all** totals + nested lists scoped to that language; missing default → `403 LANGUAGE_NOT_SELECTED` |
| `GET /api/dashboard/progress-history` | accepts `?language=en\|zh`; daily counts scoped; missing default → `403 LANGUAGE_NOT_SELECTED` |
| `GET /api/reading-exercises` | accepts `?language=en\|zh`; admin may also pass `language=all`; items include `language` |
| `GET /api/reading-exercises/:slug` | response includes `language` |
| `POST /api/reading-exercises` *(admin)* | body accepts `language`; required if `user.language IS NULL` (or `language` provided explicitly); response includes `language` |
| `GET /api/vocabulary` | accepts `?language=en\|zh`, `?hskLevel`, `?cefrLevel`; `search` also matches `pinyin` for `zh` entries; items include `language`, `pinyin`, `hskLevel` |
| `POST /api/vocabulary` | body accepts `pinyin`, `hskLevel`, `language`; language-aware cross-field validation |
| `PUT /api/vocabulary/:id` | accepts `pinyin`, `hskLevel`; `language` is immutable; cross-field validation against stored language |
| `GET /api/vocabulary/tags` | accepts `?language=en\|zh`; scopes the tag union |

`PUT /api/vocabulary/:id/favorite`, `PUT /api/vocabulary/:id/progress`, `PUT /api/flashcards/:id/progress`, `POST /api/topics/:slug/progress/reset`, `POST /api/reading-exercises/:slug/attempts`, `GET /api/reading-exercises/:slug/attempts`, `DELETE` endpoints — **unchanged** (they operate on a specific resource by id/slug; language is implicit).

### New standard error code

| HTTP | code | When |
|------|------|------|
| 403 | `LANGUAGE_NOT_SELECTED` | caller's `user.language IS NULL` AND the endpoint needs to default from it. Frontend MUST treat as "redirect to `/choose-language`". |

### Decisions to honor (v6)

- **`Flashcard` shape is intentionally unchanged.** Language comes from `topic.language`. Frontend hooks that fetch a topic detail already get the language; flashcard study screens read it from the parent payload, NOT from each card.
- **Per-language slug uniqueness** — backend uses `@@unique([slug, language])` on both Topic and ReadingExercise (see `data-model.md` v6). Slug collisions within the same language still get the `-2,-3,…` suffix; cross-language same-slug is allowed.
- **`language` is immutable on existing rows** (Topic, ReadingExercise, VocabularyEntry). PUT silently ignores or 400s on any attempt to change it — implementation choice; recommendation: silent ignore for `Topic` (forward-compat), 400 for `VocabularyEntry` (clearer error during the entry edit form).
- **Detail endpoints never `LANGUAGE_NOT_SELECTED`.** Only endpoints that need to *default* from `user.language` (list filters, create-body inherit) gate on it. Detail endpoints return the resource as stored regardless of caller's current language — frontend may nudge a switch in UI but the API does not enforce.
- **`PUT /api/users/me/language` never gates on `LANGUAGE_NOT_SELECTED`** — the caller is the one setting it.
- **`/admin/reading` MAY pass `?language=all`** to see every exercise; the server treats `all` as "no filter" only when `caller.role === "ADMIN"`. Non-admin `all` → `400 VALIDATION_ERROR`.
- **Backfill (migration):** every existing `User`/`Topic`/`ReadingExercise`/`VocabularyEntry` row gets `language = "en"`. Existing users keep working without seeing `/choose-language` (their `language` is `"en"`, not `null`). Only newly-registered users land on `/choose-language`. See `data-model.md` v6.
- **Cross-field validation (VocabularyEntry):**
  - `language === "en"` ⇒ `pinyin IS NULL`, `hskLevel IS NULL`. `cefrLevel` may be set.
  - `language === "zh"` ⇒ `cefrLevel IS NULL`. `pinyin` optional string; `hskLevel` optional integer in `[1,6]`.
  - Violation → `400 VALIDATION_ERROR` with a Vietnamese `message` explaining the mismatch.
- **`search` on `GET /api/vocabulary`** *(v6 — additive)* also matches `pinyin` when present, so a learner can search "ni hao" and find `你好` (case-insensitive substring; tone marks ignored on the search-side — implementation may normalize `nǐ → ni`).
- **TTS + dictionary auto-fill remain CLIENT-ONLY.** TTS for Chinese uses `SpeechSynthesisUtterance.lang = "zh-CN"`; dictionary auto-fill for Chinese is OPTIONAL in v6 (frontend may skip for `zh` — `api.dictionaryapi.dev` does not cover Mandarin; an alternative source is out of scope).
- **`Language` literals are lowercase** at the wire: `"en"`, `"zh"`. Anything else (`"EN"`, `"chinese"`, etc.) → `400 VALIDATION_ERROR`.
- **No changes to any endpoint's response status codes** — only request handling, response field additions, and the new `403 LANGUAGE_NOT_SELECTED` code.

### Amendment 2026-06-13 — `:slug` collision resolution & `/review` classification

Triggered by QA findings F1 and F2 in `_workspace/03_qa/qa-report-v6.md`. Disambiguates two corner cases that arose only because `(slug, language)` is the v6 unique tuple (not global slug).

**Decision 1 — `GET /api/topics/:slug/review` is list-style, not detail-style.**

It returns `{ items, total, dueCount }`, so it belongs with `GET /api/topics`, dashboard, etc.:
- Accepts optional `?language=en|zh`.
- Defaults to caller's `user.language`.
- If `user.language IS NULL` AND no `?language=` → `403 LANGUAGE_NOT_SELECTED` (matches every other list endpoint).
- The `:slug` lookup uses the resolved language: `findFirst({ where: { slug, language } })`. 404 if no row matches.

**Decision 2 — Detail endpoints (`GET /api/topics/:slug`, `GET /api/reading-exercises/:slug`, and every other `:slug` operation) use this resolution order:**

1. If the caller passed `?language=` explicitly → match `(slug, language)` exactly. 404 if not found.
2. Else if `user.language IS NOT NULL` → prefer the row matching `(slug, user.language)`. If no such row exists, fall through to (3).
3. Else fall back to the deterministic "ANY" row: order by `(createdAt ASC, id ASC)`, take the first row with that slug. 404 only if no row exists with that slug in any language.

This:
- Preserves the detail-endpoint guarantee that `LANGUAGE_NOT_SELECTED` is never raised (deep-links work for fresh users).
- Resolves the previously-undefined Postgres pick when both `en/travel` and `zh/travel` exist.
- Makes the common case (the user opens a link to a topic in their current language) always pick the right row.
- Doesn't break frontend behavior for non-colliding slugs (the lookup degenerates to a single match).
- Applies uniformly to `GET`, `PUT`, `DELETE` `/api/topics/:slug`, `POST /api/topics/:slug/flashcards`, `POST /api/topics/:slug/progress/reset`, `GET /api/reading-exercises/:slug`, `POST /api/reading-exercises/:slug/attempts`, `GET /api/reading-exercises/:slug/attempts`, `PUT/DELETE /api/reading-exercises/:slug`, `POST/PUT/DELETE /api/reading-exercises/:slug/questions[/:id]`. Authorization (owner-check for user-created, admin-check for reading) runs AFTER the slug resolves.
- Does NOT apply to `GET /api/vocabulary/:id` (id is globally unique — no collision possible).

**Implementation note for backend (Son):** add a small helper `resolveSlugTopic(slug, opts: { explicitLanguage?, userLanguage? }) → Topic | null` that encodes the three-step rule once. Reuse it on every `:slug` controller path. Same shape for `resolveSlugExercise`. The compound unique index makes (1) and (2) one indexed lookup each.

**Implementation note for frontend (Ha):** TanStack Query cache keys for the detail page should be `["topic", slug, currentLanguage]` (i.e. include the language) — otherwise switching language while the page is cached will surface a stale render of the previous-language topic before the refetch arrives. For `/topics/[slug]` and `/reading/[slug]`, after a language switch via TopNav, invalidate (or remove) the `["topic", slug, *]` / `["exercise", slug, *]` entries even though the URL hasn't changed.

**QA acceptance (Mai):** F1 and F2 are now grounded in the contract — backend implementation is the source of truth and must match these three rules. Validate that:
1. `GET /api/topics/foo/review` with `user.language=null` and no query param returns `403 LANGUAGE_NOT_SELECTED` (not 404).
2. With both `en/travel` and `zh/travel` seeded, `GET /api/topics/travel` returns the row matching `user.language`. With `?language=zh` it returns `zh/travel` regardless of `user.language`.
3. With only `en/travel` and `user.language="zh"`, `GET /api/topics/travel` still returns the `en/travel` row (fallback step 3) — the response `language` field then signals to the frontend that this is a cross-language read.
