# QA Report — Integration Coherence (E-Learning MVP)

**Date:** 2026-06-09
**Inspector:** qa-inspector
**Reference (single source of truth):** `_workspace/01_design/api-contract.md`
**Method:** read both sides of every boundary together (producer `res.json` ↔ consumer hook type ↔ contract). Verified actual code, not reports. Ran backend `tsc --noEmit`, frontend `tsc --noEmit`, and `next build`.

## Verdict: GATE PASS — deploy-ready

- **PASS: 36** · **FAIL: 0** · **UNVERIFIED: 2** (runtime-only, see below — not blockers)
- All 12 contract endpoints are shape-, path-, method-, and auth-coherent across backend → contract → frontend.
- Backend `tsc --noEmit` → exit 0. Frontend `tsc --noEmit` → exit 0. `next build` → compiled successfully, all 9 routes generated.

---

## 1. Response shape ↔ hook type ↔ contract (per endpoint)

| # | Endpoint | Producer (`res.json`) | Consumer (hook type / unwrap) | Result |
|---|----------|----------------------|-------------------------------|--------|
| 1 | POST /api/auth/register | authController.ts:37 `{ token, user: toUser }` | useAuth.ts:14 `fetchJson<AuthResponse>` | PASS |
| 2 | POST /api/auth/login | authController.ts:56 `{ token, user }` | useAuth.ts:30 `fetchJson<AuthResponse>` | PASS |
| 3 | GET /api/auth/me | authController.ts:65 `{ user }` | useAuth.ts:43 `fetchJson<MeResponse>` | PASS |
| 4 | GET /api/topics | topicController.ts:32 `{ items, total }` | useTopics.ts:13 `ListResponse<TopicSummary>`; unwrapped topics/page.tsx:43 `data.items.map` | PASS — wrapper on both sides |
| 5 | GET /api/topics/:slug | topicController.ts:65 single `TopicDetail` (no wrapper) | useTopics.ts:24 `TopicDetail`; consumed `data.flashcards` topics/[slug]/page.tsx:55 (no false unwrap) | PASS |
| 6 | PUT /api/flashcards/:id/progress | topicController.ts:100 `{ flashcardId, known, updatedAt }` | useTopics.ts:34 `FlashcardProgressResponse` | PASS |
| 7 | POST /api/topics/:slug/progress/reset | topicController.ts:133 `{ slug, resetCount, knownCount, completionPercent }` | useTopics.ts:48 `TopicResetResponse`; reads `res.resetCount` [slug]/page.tsx:125 | PASS |
| 8 | GET /api/dashboard | dashboardController.ts:42 `{ totals, topicProgress:{items,total}, recentAttempts:{items,total} }` | useDashboard.ts:11 `DashboardResponse`; nested unwrap dashboard/page.tsx:95,128 | PASS — nested wrappers match |
| 9 | GET /api/reading-exercises | readingController.ts:41 `{ items, total }` | useReading.ts:15 `ListResponse<ReadingExerciseSummary>`; unwrap reading/page.tsx:43 | PASS |
| 10 | GET /api/reading-exercises/:slug | readingController.ts:56 `ReadingExerciseDetail`, questions via `toReadingQuestionPublic` (NO correctIndex) | useReading.ts:31 `ReadingExerciseDetail` (type omits correctIndex) | PASS — correctIndex correctly absent |
| 11 | POST /api/reading-exercises/:slug/attempts | readingController.ts:124 (201) `ReadingAttemptResult` w/ graded questions (correctIndex+selectedIndex+correct) | useReading.ts:63 `ReadingAttemptResult` | PASS |
| 12 | GET /api/reading-exercises/:slug/attempts | readingController.ts:150 `{ items, total }` summary attempts (no per-question) | useReading.ts:43 `ListResponse<ReadingAttempt>`; unwrap history/page.tsx:67 | PASS |

### correctIndex source-of-truth check (the classic leak)
PASS. `correctIndex`/`selectedIndex`/`correct` are rendered ONLY from the submit-attempt result, not the detail GET:
- Answer mode renders from `data.questions` (detail GET, public shape) — reading/[slug]/page.tsx:203.
- Review mode renders from `result.questions` (graded POST response) — reading/[slug]/page.tsx:143, reads `q.correct` :149, `q.correctIndex` :160, `q.selectedIndex` :161.
- Serializer `toReadingQuestionPublic` (serializers.ts:72) omits correctIndex; `toReadingQuestionGraded` (serializers.ts:82) includes it. Sync vs graded shapes cleanly separated.

---

## 2. Path + method coherence

| Endpoint | Backend route (file:line) | Frontend call (file:line) | Result |
|----------|---------------------------|---------------------------|--------|
| POST /api/auth/register | authRoutes.ts:8 | useAuth.ts:15 POST | PASS |
| POST /api/auth/login | authRoutes.ts:9 | useAuth.ts:31 POST | PASS |
| GET /api/auth/me | authRoutes.ts:10 | useAuth.ts:44 GET | PASS |
| GET /api/topics | topicRoutes.ts:11 (`/` under `/api/topics`) | useTopics.ts:16 GET | PASS |
| GET /api/topics/:slug | topicRoutes.ts:12 | useTopics.ts:27 GET | PASS |
| POST /api/topics/:slug/progress/reset | topicRoutes.ts:13 | useTopics.ts:50 POST | PASS |
| PUT /api/flashcards/:id/progress | flashcardRoutes.ts:9 (mounted `/api/flashcards`) | useTopics.ts:36 PUT | PASS |
| GET /api/dashboard | dashboardRoutes.ts:9 (`/` under `/api/dashboard`) | useDashboard.ts:12 GET | PASS |
| GET /api/reading-exercises | readingRoutes.ts:13 | useReading.ts:18 GET | PASS |
| GET /api/reading-exercises/:slug | readingRoutes.ts:14 | useReading.ts:33 GET | PASS |
| POST /api/reading-exercises/:slug/attempts | readingRoutes.ts:15 | useReading.ts:60 POST | PASS |
| GET /api/reading-exercises/:slug/attempts | readingRoutes.ts:16 | useReading.ts:46 GET | PASS |

Route-ordering note: `GET /:slug` and `POST /:slug/attempts` + `GET /:slug/attempts` do not collide (distinct method/sub-path). PASS.

---

## 3. Auth boundary

- Frontend attaches `Authorization: Bearer <token>` for all auth'd calls — api.ts:42-43; `auth:false` only on register/login — useAuth.ts:18,34. PASS.
- Backend: `requireAuth` middleware on every route EXCEPT register/login — authRoutes.ts:8-10, topicRoutes.ts:11-13, flashcardRoutes.ts:9, dashboardRoutes.ts:9, readingRoutes.ts:13-16. PASS.
- Middleware accepts both `authorization`/`Authorization`, rejects missing/empty/invalid token with 401 `UNAUTHENTICATED`, and re-checks user existence — auth.ts:22-48. Matches contract §4. PASS.

## 4. Error shape

- Backend always emits `{ error: { code, message } }` (errorHandler.ts:13,21,29; notFoundHandler.ts:35). Malformed-JSON mapped to 400 `VALIDATION_ERROR`. PASS.
- Frontend parses `errData?.error?.code` / `.message` into `ApiError(code, message, status)` — api.ts:79-83. Error codes used downstream: 404 branch in topics/[slug]/page.tsx:146 and reading/[slug]/page.tsx:81 read `error.status === 404`. PASS.
- Error codes match contract table (VALIDATION_ERROR / UNAUTHENTICATED / INVALID_CREDENTIALS / NOT_FOUND / EMAIL_TAKEN / INTERNAL_ERROR) — used in controllers and lib/errors. PASS.

## 5. Links ↔ real App Router routes

Route files: `/`, `/login`, `/register`, `(app)/dashboard`, `(app)/topics`, `(app)/topics/[slug]`, `(app)/reading`, `(app)/reading/[slug]`, `(app)/reading/[slug]/history`. Route groups `(app)`/`(auth)` strip to root.

| Link | Source | Target route | Result |
|------|--------|--------------|--------|
| `/login`,`/register` | login/register pages, layout/root redirects | exist | PASS |
| `/dashboard` | page.tsx:31 redirect, top-nav.tsx:93 | dashboard/page.tsx | PASS |
| `/topics`, `/topics/${slug}` | dashboard:89,106; topics:65; nav | topics + [slug] | PASS |
| `/reading`, `/reading/${slug}` | reading:63; reading [slug] back:259; dashboard:161 (`a.exerciseSlug`) | reading + [slug] | PASS |
| `/reading/${slug}/history` | reading/[slug]:108,195 | history/page.tsx | PASS |
| `/login` (logout/guard) | top-nav.tsx, (app)/layout.tsx:28, page.tsx:23 | login | PASS |

No link points to a non-existent URL. PASS.

## 6. State transitions (UI ↔ API)

- **Flashcard known⇄unknown**: UI mark(true/false) → PUT progress upsert (topicController.ts:94-98), optimistic toggle + revert on error — topics/[slug]/page.tsx:93-116. Both directions of the transition exist on both sides. PASS.
- **Topic reset**: UI confirm dialog → POST reset → `updateMany known:true → false` (topicController.ts:124-131); UI sets all cards known:false and resets index — topics/[slug]/page.tsx:118-133. PASS.
- **Reading submit → review**: answer mode → POST attempt → server grades + persists immutable attempt (readingController.ts:107-122) → returns graded result → UI switches to review from `result.questions` — reading/[slug]/page.tsx:44-67,130. `retry()` clears result+answers back to answer mode. PASS.
- No declared transition is dead; no code `status`-style write is undeclared (this MVP has no enum status machine — boolean `known` + immutable attempts only).

## 7. Data flow (casing / null)

- Prisma snake_case columns (`title_vi`, `correct_index`, `created_at`, …) are `@map`-ped; serializers (serializers.ts) emit camelCase at the wire boundary. No snake_case leaks into any `res.json`. PASS.
- Nullable fields handled on both sides: `description: string | null` (types.ts:30), `example: string | null` (rendered conditionally [slug]/page.tsx:244), `bestScore: number | null` (serializers.ts:37, type :70). PASS.

## 8. Endpoint ↔ hook 1:1 (no orphans)

All 12 contract endpoints have exactly one calling hook (table §2); no hook targets a non-existent endpoint. No orphan endpoints, no dangling hooks. PASS.

## 9. Build & type signals

- Backend `npx tsc --noEmit` → **exit 0**.
- Frontend `npx tsc --noEmit` → **exit 0**.
- Frontend `npm run build` (Next 16.2.7) → **compiled successfully**, TypeScript validated, 9 routes generated (5 static, 4 dynamic).
- No `as`-cast shape-laundering around fetch beyond the single intentional `data as T` in the typed wrapper (api.ts:86), which is guarded by hook-level generics matched to the contract above. PASS.

## 10. Seed ↔ schema validity

- seed.ts upserts demo user + 4 topics × 10 flashcards + 3 reading exercises × (5/4/5) questions. All required schema fields supplied; relations set via parent id. `correctIndex` values are within each question's `options` range (verified 0–3 against 4-option arrays). `order` assigned by index. Idempotent upsert/delete-recreate pattern. PASS.

---

## UNVERIFIED (runtime-only, non-blocking)

1. **Live HTTP round-trip / actual JWT verify against a running Postgres** — UNVERIFIED. Reason: no DB/server brought up in this static pass. Shapes, paths, auth wiring, and types are statically coherent; recommend a smoke run post-deploy (login → topics → mark → dashboard → reading submit → history).
2. **`bestScore`/`completionPercent` numeric correctness with real attempt data** — UNVERIFIED at runtime. Logic reviewed (groupBy `_max.score`, `Math.round` completion) and looks correct; only flagged because it depends on seeded user progress not exercised statically.

Neither blocks the gate: both are confirmation-of-already-coherent-logic, not suspected defects.

## FAIL list

None.

## Conclusion

Every boundary across all 12 endpoints agrees between backend response, contract, and frontend hook — including the high-risk cases (list `{items,total}` wrappers + correct `.items` unwrap, dashboard nested wrappers, detail objects not falsely unwrapped, and `correctIndex` present only on the graded submit response). Auth, error shape, routing, state transitions, casing, and seed integrity all pass. Builds pass on both sides. **Gate: PASS — clear to deploy.** Run the post-deploy smoke flow to close the two UNVERIFIED runtime items.

---

# My Vocabulary (v2) — incremental QA

Verified against contract v2 (lines 363–543) + data-model VocabularyEntry, reading CODE both sides of every boundary. 8 endpoints.

## Boundary results

| # | Boundary | Producer (backend) | Consumer (frontend) | Verdict |
|---|----------|--------------------|--------------------|---------|
| 1a | GET /vocabulary shape + wrapper | vocabularyController.ts:76 `{items,total}` | useVocabulary.ts:30 `ListResponse<VocabularyEntry>`; page.tsx:83 `data?.items ?? []` | PASS |
| 1b | GET /vocabulary/tags wrapper of strings | controller.ts:98 `{items,total}` string[] | useVocabulary.ts:41 `ListResponse<string>`; page.tsx:170 `tagsData?.items ?? []` | PASS |
| 1c | GET /:id single object (no wrapper) | controller.ts:132 `toVocabularyEntry` | useVocabulary.ts:50 `VocabularyEntry`; edit page.tsx:21 used directly | PASS |
| 1d | DELETE → 200 {success:true} (not 204) | controller.ts:168 `res.status(200).json({success:true})` | useVocabulary.ts:81 `DeleteResponse`; api.ts:64-86 parses 200 JSON body | PASS |
| 1e | favorite → {id,isFavorite} | controller.ts:182 select id+isFavorite | types.ts:158 `VocabularyFavoriteResponse`; page.tsx:97 uses returned shape (optimistic on isFavorite) | PASS |
| 1f | progress → {id,known} | controller.ts:196 select id+known | types.ts:164 `VocabularyProgressResponse`; study page.tsx:90 | PASS |
| 1g | optional scalar null / array always present | serializers.ts:115-122 `?? null` / `?? []` | types.ts:120-127 `string\|null` + `string[]`; renders guard `entry.tags.length`, `synonyms.length`, `pronunciation &&` | PASS |
| 2 | Path+method of 8 hooks vs routes | vocabularyRoutes.ts:19-26 | useVocabulary.ts all 8 calls | PASS |
| 2b | /tags registered BEFORE /:id | routes.ts:20 (/tags) before :22 (/:id) | — | PASS |
| 3 | Auth Bearer on every route | routes.ts every line `requireAuth`; auth.ts:44 sets req.userId | api.ts:41-43 attaches Bearer (default auth=true) | PASS |
| 3b | Ownership → 404 (no existence leak) | controller.ts:35-41 getOwnedEntry: non-owner → NOT_FOUND; list where scoped userId (54) | edit page.tsx:50 distinct 404 branch ("không thuộc về bạn") | PASS |
| 4 | Query params names match | controller.ts:47-52 reads search/tag/partOfSpeech/favorite/sort | useVocabulary.ts:17-22 sets same names | PASS |
| 5 | Validation word/meaning req, cefr enum, arrays default [] | controller.ts:15-29 zod (trim min1, z.enum CEFR, default []) | form:128 requires word/meaning; CEFR_LEVELS:13 same 6 values | PASS |
| 6 | Dictionary/TTS client-only, no Bearer/no api client | — | dictionary.ts (direct fetch dictionaryapi.dev, 404→DictionaryNotFoundError, no token); tts.ts isTtsSupported guard; no fetchJson/@/lib/api import in either | PASS |
| 7a | Nav + links resolve to real App Router routes | — | top-nav.tsx:31 /vocabulary; links to /new,/study,/[id]/edit,/vocabulary all map to real page.tsx (build lists all 4) | PASS |
| 7b | Flashcard study reuse (deck=GET list, progress=PUT /:id/progress) | controller listVocabulary + setProgress | study page.tsx:29 useVocabulary deck; :90 setVocabularyProgress | PASS |
| 8 | Migration ↔ schema; idempotent; index | migration 20260609010000: snake_case @map cols match schema.prisma:129-152; CREATE TABLE IF NOT EXISTS + IF NOT EXISTS indexes + guarded FK; 2 indexes (userId,createdAt)/(userId,word) | — | PASS |
| B1 | Backend `npx tsc --noEmit` | exit 0 | — | PASS |
| B2 | Frontend `npx tsc --noEmit` | — | exit 0 | PASS |
| B3 | Frontend `npm run build` | — | exit 0; 4 vocabulary routes emitted | PASS |

## FAIL / UNVERIFIED
None. No FAIL. No UNVERIFIED (both sides present and runnable for every boundary).

## Conclusion — My Vocabulary (v2)
All 8 endpoints' response shapes agree across backend ↔ contract ↔ frontend hook, including the high-risk cases: `{items,total}` wrappers correctly unwrapped (`.items`) on both list + tags, detail/create/update returned as bare objects (not falsely unwrapped), DELETE 200-JSON parsed (frontend does not expect 204), and minimal favorite/progress shapes consumed by the exact fields. Ownership scoping returns 404 without leaking existence. `/tags` is correctly registered before `/:id`. Dictionary auto-fill + TTS are genuinely client-only (no Bearer, no internal api client). Validation, casing, migration/schema/index, seed idempotency, links↔routes, and flashcard-study reuse all pass. Both typechecks and the production build pass. **Gate: PASS — My Vocabulary clear.**

---

# shadcn refactor QA (native → shadcn component) — 2026-06-09

Scope: native `<select>`→shadcn `Select`, `<textarea>`→`Textarea`, 1 user-menu `<button>`→`Button`. Radix Select sentinels (`CEFR_NONE="none"`, `TAG_ALL="__all__"`) are the primary risk. Verified against `api-contract.md` (vocabulary query params + POST/PUT body).

## Summary
- Total: **13 PASS / 0 FAIL / 0 UNVERIFIED**
- Sentinel leakage to API: **NONE** — `CEFR_NONE`/`TAG_ALL`/`__all__` never reach payload, query string, hook, or types.
- Gate: **PASS**

## Sentinel mapping (2-way) — highest risk
| ID | Check | Producer (UI) | Consumer (payload/query) | Verdict |
|----|-------|---------------|--------------------------|---------|
| S1 | Form CEFR "(không)" → body omits `cefrLevel` (no literal) | vocabulary-form.tsx:316-319 maps `CEFR_NONE→""` on change | vocabulary-form.tsx:99 `if (s.cefrLevel) input.cefrLevel=...` — empty string is falsy ⇒ field omitted | PASS |
| S2 | Edit prefill: entry `cefrLevel=null` shows sentinel, no crash | stateFromEntry vocabulary-form.tsx:79 `entry.cefrLevel ?? ""` | Select value vocabulary-form.tsx:316 `form.cefrLevel || CEFR_NONE` ⇒ renders "— Không chọn —" | PASS |
| S3 | Edit prefill: entry `cefrLevel="C1"` selects C1 | stateFromEntry:79 → `"C1"` | Select:316 `"C1" || CEFR_NONE` = `"C1"` matches SelectItem value | PASS |
| S4 | Filter tag "Tất cả" → query drops `tag` param | page.tsx:171-172 maps `TAG_ALL→""` | page.tsx:78 `tag: tag || undefined` + useVocabulary.ts:19 `if (params.tag)` ⇒ omitted | PASS |
| S5 | Filter tag specific → `tag=<value>` sent | page.tsx:172 sets raw tag | useVocabulary.ts:19 `q.set("tag", params.tag)` | PASS |
| S6 | Sort newest/oldest/az → `sort` param matches backend | page.tsx:193-197 raw value | useVocabulary.ts:21 `q.set("sort", params.sort)`; contract api-contract.md:379 enumerates exactly these | PASS |
| S7 | No sentinel literal in any payload (grep) | — | grep: `CEFR_NONE`/`TAG_ALL`/`__all__` appear ONLY in select.tsx-consuming UI (vocabulary-form.tsx, page.tsx); absent from hooks/types/query builder | PASS |

Note S6: `sort` default is `"newest"` (page.tsx:71) and is always sent. Contract treats it as optional with `"newest"` default — sending the explicit default is contract-conformant (idempotent), not a behavior change.

## Textarea (a11y + 2-way binding)
| ID | Check | file:line | Verdict |
|----|-------|-----------|---------|
| T1 | exampleSentence value/onChange 2-way | vocabulary-form.tsx:285-289 `value=form.exampleSentence` + `set("exampleSentence",…)` | PASS |
| T2 | notes value/onChange 2-way | vocabulary-form.tsx:295-299 | PASS |
| T3 | Label htmlFor↔Textarea id match | exampleSentence:284↔286, notes:294↔296 | PASS |
| T4 | Textarea forwards id/value/onChange/disabled via `...props` | textarea.tsx:7,15 spreads props onto native `<textarea>` | PASS |

## Select (a11y) + filter behavior parity
| ID | Check | file:line | Verdict |
|----|-------|-----------|---------|
| A1 | CEFR Label↔trigger: `htmlFor="cefrLevel"` ↔ `SelectTrigger id="cefrLevel"` + aria-label | vocabulary-form.tsx:314 ↔ 321 | PASS |
| A2 | Trigger forwards id (SelectTrigger spreads `...props` to Radix Trigger) | select.tsx:15-22 | PASS |
| A3 | Placeholder shows when unset; filter Selects have aria-label | vocabulary-form.tsx:322; page.tsx:174,199 aria-label | PASS |
| A4 | Filter parity: search/tag/partOfSpeech/favorite/sort → contract query string unchanged | page.tsx:75-84 → useVocabulary.ts:16-25 vs api-contract.md:375-379 | PASS |

## Flip-card native exception (not a miss)
| ID | Check | file:line | Verdict |
|----|-------|-----------|---------|
| F1 | study flip kept native `<button>` w/ justified-exception comment | vocabulary/study/page.tsx:155-157 | PASS |
| F2 | topic flip kept native `<button>` w/ justified-exception comment | topics/[slug]/page.tsx:228-230 | PASS |

## Build & type signals
| ID | Check | Result | Verdict |
|----|-------|--------|---------|
| B1 | `npx tsc --noEmit` (root) | exit 0 | PASS |
| B2 | `npm run build` | exit 0; all 12 routes emitted incl. vocabulary new/edit/study | PASS |

## Conclusion — shadcn refactor
Sentinel mapping is correct in **both directions** and the sentinels are fully contained at the UI layer: the `|| sentinel` (display) and `=== sentinel ? "" : v` (change) pattern, combined with the existing `if (truthy)` guards in `toInput` (vocabulary-form.tsx:99) and `buildVocabularyQuery` (useVocabulary.ts:19), guarantees **no `CEFR_NONE`/`TAG_ALL` literal can reach the request body or query string**. Textarea and Select preserve 2-way binding and label/id a11y; filter/sort produce the identical contract query string as before; both flip-cards intentionally retain native `<button>` with explicit comments (not oversights). Typecheck + production build pass. **Gate: PASS — refactor preserves behavior, no API leakage.**
