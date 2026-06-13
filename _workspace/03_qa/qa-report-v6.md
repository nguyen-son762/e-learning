# QA Report — v6 (Chinese Learning Module)

**Owner:** Mai (qa-inspector)
**Date:** 2026-06-13
**Status:** PARTIAL — backend boundaries verified; frontend pending (Ha module not yet ready)
**Contract:** `_workspace/01_design/api-contract.md` (v6)
**Brief:** `_workspace/00_input/feature-chinese-learning.md`

Verification method: read producer + consumer of each boundary together; PASS only when both sides agree exactly with the contract.

---

## Boundary 1 — Contract ↔ Prisma schema

| Contract field | Prisma column | Status |
|---|---|---|
| `User.language: "en"\|"zh"\|null` | `User.language String?` (`server/prisma/schema.prisma:26`) | PASS |
| `Topic.language: "en"\|"zh"` | `Topic.language String @default("en")` (line 47) | PASS |
| `Topic` per-language slug unique | `@@unique([slug, language])` (line 53) replaces global unique | PASS |
| `ReadingExercise.language` | `String @default("en")` (line 109) + `@@unique([slug, language])` (line 113) | PASS |
| `VocabularyEntry.language` | `String @default("en")` (line 158) | PASS |
| `VocabularyEntry.pinyin: string\|null` | `pinyin String?` (line 156) | PASS |
| `VocabularyEntry.hskLevel: int\|null` | `hskLevel Int? @map("hsk_level")` (line 157) | PASS |
| `Flashcard` unchanged (inherits language from topic) | No `language` on `Flashcard` model | PASS |

**Migration `20260613000000_multi_language/migration.sql`:** PASS
- Adds nullable `users.language`; non-null `language` with DEFAULT `'en'` on topics/reading_exercises/vocabulary_entries; new columns `pinyin`, `hsk_level` on vocabulary_entries.
- Drops `topics_slug_key`, `reading_exercises_slug_key`; creates compound `(slug, language)` unique + `language` filtering indexes.
- Explicit backfill `UPDATE ... SET language='en' WHERE language IS NULL` (idempotent; brief AC §6 satisfied).

---

## Boundary 2 — Contract ↔ Backend response shapes

### 2.1 `User` shape
**Contract** (`api-contract.md:86`):
```ts
User { id, email, name, role, language: Language | null, createdAt }
```
**Producer** (`server/src/lib/serializers.ts:24-33`): returns exactly those fields, `asLanguageOrNull(u.language)` clamps anything outside `"en"|"zh"` to `null`. **PASS**.

### 2.2 `PUT /api/users/me/language`
**Contract** (`api-contract.md:8`): `200 { user: User }`, body `{ language: "en"|"zh" }`, idempotent, never throws `LANGUAGE_NOT_SELECTED`.
**Producer** (`server/src/controllers/userController.ts:13-26`): `parseBody(z.object({language: z.enum(["en","zh"])}))` → `prisma.user.update` → `res.status(200).json({ user: toUser(updated) })`. Bypasses any language-gate check. **PASS**.
**Route** (`server/src/routes/userRoutes.ts:10`): `PUT /me/language` mounted at `/api/users` (`server/src/app.ts:25`) → full path `/api/users/me/language` matches contract. **PASS**.

### 2.3 `GET /api/auth/me` carries `language`
`toUser` (serializers.ts:30) always emits `language`. **PASS** (consumer side TBD once Ha lands).

### 2.4 List endpoints accept `?language=`
| Endpoint | File:line | `resolveListLanguage` used? |
|---|---|---|
| `GET /api/topics` | `topicController.ts:11-37` | yes (line 13) |
| `GET /api/topics/:slug/review` | `topicController.ts:521-583` | **NO — see Finding F1** |
| `GET /api/dashboard` | `dashboardController.ts:9-72` | yes (line 11) |
| `GET /api/dashboard/progress-history` | `dashboardController.ts:77-141` | yes (line 82) |
| `GET /api/reading-exercises` | `readingController.ts:17-47` | yes (line 19) |
| `GET /api/vocabulary` | `vocabularyController.ts:85-119` | yes (line 87) |
| `GET /api/vocabulary/tags` | `vocabularyController.ts:123-143` | yes (line 125) |

### 2.5 Per-language field validity on Vocabulary
**Producer** (`vocabularyController.ts:47-69, 151, 165-167, 199`):
- `zh` + non-null `cefrLevel` → 400 PASS
- `en` + non-null `pinyin` → 400 PASS
- `en` + non-null `hskLevel` → 400 PASS
- Storage: `cefrLevel` written only when `language === "en"`; `pinyin`/`hskLevel` only when `"zh"` (lines 165-167). **PASS**.

### 2.6 `language` immutability on PUT `/api/vocabulary/:id`
**Producer** (`vocabularyController.ts:192-198`): reads `existing.language`, throws `VALIDATION_ERROR` if body sends a different one. **PASS**. (Topic + ReadingExercise PUTs do not touch `language` in their schemas; effectively immutable. PASS.)

### 2.7 Detail endpoints DO NOT throw `LANGUAGE_NOT_SELECTED`
| Endpoint | Behavior |
|---|---|
| `GET /api/topics/:slug` (`topicController.ts:40-82`) | `findFirst({where:{slug}})`, no language resolution. PASS. |
| `GET /api/reading-exercises/:slug` (`readingController.ts:50-70`) | same. PASS. |
| `GET /api/vocabulary/:id` (`vocabularyController.ts:179-183`) | owner-scoped lookup, no language gate. PASS. |

### 2.8 Error code mapping
`server/src/lib/errors.ts:14` maps `LANGUAGE_NOT_SELECTED → 403`. **PASS** (contract `api-contract.md:76`).

### 2.9 Wire-format casing
Serializers emit lowercase `"en"|"zh"` only; never leaks `null` for non-User shapes. **PASS**.

---

## Boundary 5 — Seed sanity

**File:** `server/prisma/seed.ts`
- 13 ZH topic slugs (`hsk1-*` x5, `hsk2-*` x5, `hsk3-*` x3) — matches brief §5. **PASS**.
- 200 ZH flashcards across the 13 topics (counted directly). **PASS** (brief AC ≥200).
- All 13 ZH topics tagged `language: "zh"`. **PASS**.
- 3 ZH reading exercises (`zh-my-family`, `zh-weather-today`, `zh-shopping-trip`). **PASS** (brief §5 — 2-3 readings).
- Tone marks used in pinyin (220 occurrences of `[āēīōūǖáéíóúǘǎěǐǒǔǚàèìòùǜ]` within the ZH section) — no numeric tone codes. **PASS** (brief AC: pinyin có dấu).
- Demo + admin users seed with `language: "en"` (per Son's report) — keeps existing flows unblocked. **PASS** (brief §6 backward compat).

---

## Boundary 7 — Backward compatibility (backend layer)

- Migration backfills `language='en'` on all pre-v6 rows (users/topics/reading_exercises/vocabulary_entries). PASS.
- Existing EN seed (`travel`, `business`, `daily-life`, `food`) untouched. PASS.
- Existing routes (`GET /api/topics` etc.) still respond — `user.language='en'` from backfill resolves cleanly. PASS.
- Pre-v6 `Topic.slug` was globally unique; now `(slug, language)` — same slug `travel` continues to map to the EN row via per-user-language default. PASS.

---

## Findings

### F1 — `GET /api/topics/:slug/review` ignores `?language=` query — **FIXED 2026-06-13**
**Severity:** LOW (didn't crash today thanks to disjoint slugs; spec'd as gated)
**Producer:** `server/src/controllers/topicController.ts:524-587` (`getTopicReview`)
**Contract:** `api-contract.md:9` includes `GET /api/topics/:slug/review` in the `?language=` gated set.
**Fix landed (Son):** added `const language = await resolveListLanguage(userId, req.query.language)` (line 530), switched to `prisma.topic.findUnique({ where: { slug_language: { slug, language } } })` (lines 532-537). Behavior now: default → `user.language`; explicit `?language=` overrides; `user.language=null` + no query → `403 LANGUAGE_NOT_SELECTED`; slug missing in requested language → `404 NOT_FOUND`.
**Re-verified by QA against producer code; Son's live curl confirms.** **PASS.**

### F2 — Detail endpoints use unfiltered `findFirst({where:{slug}})` — undefined pick on slug collision — **FIXED 2026-06-13**
**Severity:** MEDIUM (production-correctness; was not crashing today thanks to disjoint seeded slugs)
**Contract reference:** `api-contract.md:10` (rule) + `api-contract.md:1126-1159` (Amendment 2026-06-13).
**Fix landed (Son):**
- New helper `resolveSlug<T>(slug, { explicitLanguage, userLanguage, findOne, findFallback })` at `server/src/lib/language.ts:92-112` — encodes the 3-step rule once.
- `getUserLanguage(userId)` at `language.ts:116-122` — safely reads user.language, returns null instead of throwing (so detail endpoints never raise `LANGUAGE_NOT_SELECTED`).
- Per-controller wrappers `resolveSlugTopicId(req, slug)` (`topicController.ts:19-35`) and `resolveSlugExerciseId(req, slug)` (`readingController.ts:22-38`) compose `parseLanguageQuery` + `getUserLanguage` + `resolveSlug`. Fallback path uses `orderBy: [{createdAt:"asc"},{id:"asc"}]` for deterministic pick.
- Authz (owner/admin check) runs AFTER slug resolution — confirmed in `updateTopic:395`, `deleteTopic:436`, `createFlashcard`, all `readingController` admin sites.
- 16 callsites updated (5 in `topicController`, 11 in `readingController`). `getTopicReview` deliberately untouched (it's list-style per F1 fix).
**QA re-verification of 3 acceptance criteria (against producer code + Son's live tests):**
1. ✅ Fresh user (`language=null`) `GET /api/topics/foo/review` no query → `403 LANGUAGE_NOT_SELECTED` (unchanged — list-style endpoint via `resolveListLanguage`).
2. ✅ Both `en/travel` + `zh/travel`:
   - `user.language=zh`, no query → `zh/travel` (step 2)
   - `?language=en` → `en/travel` (step 1)
   - `user.language=en`, no query → `en/travel` (step 2)
3. ✅ Only `en/business`, `user.language=zh`, no query → `en/business` (step 3 fallback), response `language: "en"` signals cross-language read.
4. ✅ (Bonus) Fresh user (`language=null`) `GET /api/topics/travel` no query → 200 with deterministic fallback row; detail endpoint NEVER raises `LANGUAGE_NOT_SELECTED`. Structural guarantee: `getUserLanguage` returns null silently; step 3 fallback handles it.
**`tsc --noEmit` clean (Mai re-ran).** **PASS.**

### F3 — Slug collision against seeded EN topics on user `POST /api/topics` — **RESOLVED BY F2 AMENDMENT**
**Severity:** LOW (consequence of F2; benign once F2's 3-step rule lands)
**Producer:** `topicController.ts:296-311` (`uniqueSlug` uses compound `slug_language`); creating a user ZH topic with `title="Travel"` will produce slug `travel` since no `(travel, zh)` exists — that's correct per v6 contract.
**Status:** With Linh's amended slug-collision rule, `GET /api/topics/travel` now resolves deterministically; FE deep-links via `(slug)` are safe because step 2 prefers user's language. No separate fix needed.

### F4 — Documentation gap: contract DIFF says `?language=` applies to dashboard, but example response JSON for `GET /api/dashboard` doesn't mention language anywhere — **RESOLVED**
**Severity:** TRIVIAL — Linh confirmed `language` already appears in the dashboard example JSON (line 560). Closing.

---

## Boundary 3 — Contract ↔ Frontend hook types

### 3.1 Wire-level Language type
`src/lib/types.ts:13` — `export type Language = "en" | "zh"`. **PASS**.

### 3.2 User shape
`src/lib/types.ts:15-22` — `User.language: Language | null`. Exact match with `api-contract.md:91`. **PASS**.

### 3.3 TopicSummary / TopicDetail
`types.ts:30-44, 58-60` — `TopicSummary.language: Language` (non-null), `TopicDetail` inherits via `extends`. Matches contract `:95-109`. **PASS**.

### 3.4 ReadingExerciseSummary / Detail
`types.ts:78-86, 97-105` — both gain `language: Language`. Matches contract `:117-123`. **PASS**.

### 3.5 VocabularyEntry (incl. pinyin/hskLevel)
`types.ts:142-167` — gains `pinyin: string | null`, `hskLevel: number | null`, `language: Language`. Inline doc note clarifies en→pinyin/hskLevel null, zh→cefrLevel null. Matches contract `:136-145`. **PASS**.

### 3.6 VocabularyInput (form payload)
`types.ts:175-191` — optional `pinyin?: string`, `hskLevel?: HskLevel (1..6)`, `language?: Language`. Producer (`vocabulary-form.tsx:163-184` `toInput`) correctly emits cefrLevel only when language=en, pinyin/hskLevel only when language=zh — mirroring backend's `assertLanguageFields` check (`vocabularyController.ts:47-69`). **PASS** (cross-side agreement, won't trigger 400).

### 3.7 PUT /api/users/me/language (FE → BE wire)
**Producer (FE):** `useAuth.ts:46-56` (`updateLanguage`) — sends `{ language: "en"|"zh" }`, parses `{ user: User }` typed as `LanguagePreferenceResponse`, calls `setStoredUser` to persist.
**Consumer (BE):** `userController.ts:13-26` — accepts that exact body via zod, responds `{ user: toUser(updated) }`.
**Boundary:** PASS.

### 3.8 Optional `?language=` on list/dashboard hooks
| Hook | Sends `?language=`? | File:line |
|---|---|---|
| `useTopics(language?)` | optional | `useTopics.ts:23-31` |
| `useDashboard(language?)` | optional | `useDashboard.ts:9-15` |
| `useProgressHistory(days, language?)` | optional | `useProgressHistory.ts:8-19` |
| `useReadingExercises(language?)` | optional | `useReading.ts:13-23` |
| `useVocabulary({language?})` | optional via `buildVocabularyQuery` | `useVocabulary.ts:14-23` |
| `useVocabularyTags(language?)` | optional | `useVocabulary.ts:42-50` |
All omit the param by default and let the backend default to `user.language` — exactly matches contract `:9`. Backend's `resolveListLanguage` covers both paths. **PASS**.

### 3.9 Detail hooks (intentionally do NOT pass `?language=`)
`useTopicDetail`, `useReadingExercise`, `useVocabularyEntry` — single-resource lookup. Per contract `:10` (amended) the backend's 3-step resolution handles this; FE relies on `data.language` in the response to render the correct variant. **PASS** (FE side); backend side awaits F2 fix.

### 3.10 No orphan endpoints
- New endpoint `PUT /api/users/me/language` consumed by `updateLanguage` (useAuth.ts) → producer mounted at `userRoutes.ts`. **PASS** — no orphan.
- All v6-new query params on list endpoints exercised by FE hooks. **PASS**.

---

## Boundary 4 — Routes ↔ links

### 4.1 `/choose-language` reachable + bypasses gate
- Route file: `src/app/(app)/choose-language/page.tsx` (verified exists).
- `(app)/layout.tsx:64-67, 73-76` gates `user.language === null` → redirect `/choose-language`; explicit pathname check at `:CHOOSE_LANGUAGE_PATH` excludes choose-language itself from the gate.
- Defensive 403 listener (`layout.tsx:79-87`) also redirects.
**PASS**.

### 4.2 Auth flow redirects
- Landing (`src/app/page.tsx:21-23`): no token → /login; user.language===null → /choose-language; else /dashboard.
- Login (`src/app/(auth)/login/page.tsx:32-35`): success branches on `user.language === null` → /choose-language vs /dashboard.
- Register (`src/app/(auth)/register/page.tsx:33`): always /choose-language (contract says register returns `language: null`).
- Auth layout (`src/app/(auth)/layout.tsx:25-28`): pre-authed visitor branches identically.
**PASS** — all 4 entry points respect the gate.

### 4.3 TopNav LanguageSwitcher
- `top-nav.tsx:148-153`: renders `LanguageSwitcher` only when `user.language` is set (hidden on /choose-language by the switcher's own pathname guard at `language-switcher.tsx:55`).
- Hooked to `onLanguageChanged={refresh}` (layout.tsx:`refresh` re-fetches /api/auth/me).
- `language-switcher.tsx:60-78` calls `updateLanguage(next)` → `onChanged()` → if detail route `/topics/:slug|/reading/:slug|/vocabulary/:id` → `router.push("/dashboard")`; else `router.refresh()`.
**PASS**.

### 4.4 Defensive redirect on 403 LANGUAGE_NOT_SELECTED
- `api.ts:79-83`: when response `code === "LANGUAGE_NOT_SELECTED"`, dispatches `CustomEvent("el:language-not-selected")`.
- `layout.tsx:79-87`: window event listener catches it and redirects.
**PASS**.

---

## Boundary 6 — State transitions (language switch reload)

### 6.1 Switch via TopNav
- Order: `updateLanguage(next)` (PUT API) → `setStoredUser` (auth.ts) → `onChanged()` (calls layout's `refresh` → re-fetches `/api/auth/me`) → `router.refresh()` to re-run RSC and re-fetch data hooks → toast.
- After refresh: `AuthContext.user.language` updates → `useTopics()/useDashboard()` (omitting explicit `?language=`) will default to the new `user.language` server-side → dashboard reloads with filtered content.
**PASS**.

### 6.2 Detail-route bounce
`language-switcher.tsx:69-72`: regex catches `/topics/:slug`, `/topics/:slug/review`, `/topics/:slug/manage`, `/topics/:slug/edit`, `/reading/:slug`, `/reading/:slug/history`, `/vocabulary/:id/edit`. Bounces to /dashboard so the user doesn't land on a 404 (e.g. previous en/business doesn't exist in zh seed). **PASS**.

### 6.3 Edit vocab keeps entry's stored language
`vocabulary/[id]/edit/page.tsx:50` — passes `language={data.language}` (NOT `user.language`). Matches contract immutability rule. **PASS**.

---

## Boundary 7 (continued) — Backward compat (FE)
- All existing pages (`/topics/[slug]`, `/topics/[slug]/review`, vocab study/new/edit) branch on `data.language` (or `user.language` fallback for the review queue), defaulting to English UI when value is `"en"`. EN flow unchanged for backfilled users. **PASS**.
- `useTopics()/useDashboard()/...` called without args — backend defaults to user.language=`"en"` after backfill → EN content returned. **PASS**.

---

## FE typecheck

`npx tsc --noEmit` (project root) — **clean** (re-verified by Mai, 2026-06-13).

---

## Status summary

| # | Boundary | Status |
|---|---|---|
| 1 | Contract ↔ Prisma schema | PASS |
| 2 | Contract ↔ Backend response shapes | PASS (F1 + F2 fixed and re-verified) |
| 3 | Contract ↔ Frontend hook types | PASS |
| 4 | Routes ↔ links (`/choose-language`, redirect, TopNav switcher) | PASS |
| 5 | Seed sanity (HSK 1-3, ≥13 topics, ≥200 cards, tone marks) | PASS |
| 6 | State transitions (language switch reload) | PASS |
| 7 | Backward compat (existing en users + content) | PASS |

**Open items:** None. All findings closed (F1 fixed, F2 fixed, F3 resolved by F2 amendment, F4 doc-only).

**Deploy gate (Tu): GREEN.** All 7 boundaries PASS end-to-end. Backend tsc clean, frontend tsc clean, migration idempotent, seed counts verified, 3-step slug resolution live-tested by Son. Safe to push production.

**Status: FINAL — Task #4 closed 2026-06-13.**

---

## Addendum — FE alignment to v6 amendment (Ha, 2026-06-13, post-close)

After F2 contract amendment, Ha threaded the optional `?language=` through all 4 detail/review hooks so explicit step-1 pins are now reachable from the UI. **Not a regression — strengthens production correctness when user-created slug collisions appear.**

**Hooks updated:**
- `useTopicDetail(slug, language?)` (`src/hooks/useTopics.ts:38`) — appends `?language=` and threads into depsKey.
- `useTopicReview(slug, language?)` (`src/hooks/useTopicReview.ts:12`) — reclassified to list-style per Linh's Q1 verdict; cache key `topic-review:${slug}:${language ?? ""}`.
- `useReadingExercise(slug, language?)` (`src/hooks/useReading.ts:31`) — same shape.
- `useReadingAttempts(slug, language?)` (`src/hooks/useReading.ts:45`) — same shape.

**Call sites passing `user.language` from `AuthContext`:**
- `app/(app)/topics/[slug]/page.tsx:55-57` — `user.language ?? undefined` → `useTopicDetail(slug, language)` + `useTopicReview(slug, language)` so detail + review share cache key.
- `app/(app)/topics/[slug]/review/page.tsx:45-48` — `user.language ?? "en"`.
- `app/(app)/topics/[slug]/edit/page.tsx:47` + `/manage/page.tsx:49` — same `useAuthContext()` pull-through to `useTopicDetail`.
- `app/(app)/reading/[slug]/page.tsx:47` + `/history/page.tsx:22` — pull `user` and pass to detail/attempts hooks.

**Defensive 403 wiring (unchanged):** `useTopicReview` is now list-style on the BE → can raise `403 LANGUAGE_NOT_SELECTED`. The existing `api.ts:79-83` event dispatch + `(app)/layout.tsx:79-87` listener already redirect to `/choose-language` — no new wiring needed.

**QA verification:**
- `tsc --noEmit` (Mai re-ran) → clean.
- Cache-key fix: switching language via TopNav now invalidates `topic-review:${slug}:${language}` keys cleanly (previously the dep-key was just `topic-review:${slug}` which would have shown stale Chinese cards after switching to English). Resolves a latent staleness bug that would have surfaced only after switch-language reuses the same slug. **Caught early.**

**Status:** Detail-hook boundary re-verified PASS. No new findings. Report remains FINAL.
