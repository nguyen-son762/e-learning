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

---

## Features 4+5+8 QA — v3 (Progress chart + SRS + Reading→Vocabulary highlight)

**Date:** 2026-06-10  ·  **Inspector:** qa-inspector  ·  **Reference:** api-contract.md v3 (lines 625–650), data-model.md (FlashcardProgress SRS fields).
**Method:** read both sides of every new boundary (producer `res.json` ↔ consumer hook generic ↔ contract). Backend `tsc --noEmit` and frontend `next build` both pass.

### Verdict (final, after fix): GATE PASS — deploy-ready
- **PASS: 36**  ·  **FAIL: 0**  ·  **UNVERIFIED: 1** (migration not yet `migrate deploy`'d — by-design until deploy)
- First-pass FAIL was Feature 8 SelectionPopover sending `meaning: ""`. Fixed at selection-popover.tsx:131 — `const input: VocabularyInput = { word, meaning: word };` — and re-verified. The dictionary overwrite path at :134 still applies when available. POST body now satisfies `meaning: z.string().trim().min(1)` even when the dictionary 404s/fails (word is guaranteed non-empty by the 1–5 word selection guard at :61–66).
- Backend `npx tsc --noEmit` → exit 0. Frontend `npx tsc --noEmit` → exit 0. Frontend `next build` → compiled successfully, 14 routes incl. `/topics/[slug]/review`.

### Feature 4 — Progress chart (GET /api/dashboard/progress-history)

| # | Boundary | Producer (backend) | Consumer (frontend) | Verdict |
|---|----------|--------------------|--------------------|---------|
| 4-1 | Route exists at the path the hook calls | dashboardRoutes.ts:12 `router.get("/progress-history", requireAuth, …)` mounted under `/api/dashboard` | useProgressHistory.ts:12 GET `/api/dashboard/progress-history?days=${days}` | PASS |
| 4-2 | Response shape | dashboardController.ts:134 `res.status(200).json({ items, total: days })` where `items: Array<{ date: string; count: number }>` | useProgressHistory.ts:9 `useQuery<ListResponse<ProgressHistoryItem>>`; types.ts:198 `ProgressHistoryItem { date: string; count: number }`; types.ts:176 `ListResponse<T>={items:T[]; total:number}` | PASS — shapes match contract §625–632 exactly |
| 4-3 | `total === days` always | controller.ts:134 sets `total: days` literally | progress-chart.tsx:40 doesn't depend on `total` (uses `data.items.every`); fine | PASS |
| 4-4 | `date` is `YYYY-MM-DD` UTC, not ISO timestamp | controller.ts:118,130 `${y}-${pad2(m+1)}-${pad2(d)}` (no T/Z) | progress-chart.tsx:21–25 `formatTick` splits on `-` and emits `dd/MM` — would mis-render an ISO timestamp, so the calendar-string contract is load-bearing | PASS |
| 4-5 | Zero-fill, oldest→newest | controller.ts:127–132 loop `for i=0..days-1` from `start = today - (days-1) UTC`, push `counts.get(dateStr) ?? 0` | recharts XAxis uses `dataKey="date"` in array order — receives them oldest-first | PASS |
| 4-6 | Dedup: distinct flashcards per UTC day | controller.ts:113–123 `seen` Set keyed by `${flashcardId}|${utcDate}` | — | PASS |
| 4-7 | `days` allowlist {7, 30} → else 400 VALIDATION_ERROR | controller.ts:80–91 throws `AppError("VALIDATION_ERROR", …)` for anything other than `"7"`/`"30"` | useProgressHistory.ts:8 typed `days: 7 \| 30`; progress-chart.tsx:84 `useState<Window>("7")` only ever passes `7` or `30` | PASS |
| 4-8 | Wired into dashboard page | — | dashboard/page.tsx:19 imports, :86 renders `<ProgressChart />` | PASS |
| 4-9 | Auth Bearer | dashboardRoutes.ts:12 requireAuth | api.ts attaches Bearer by default (verified previously) | PASS |
| 4-10 | Empty/no-progress UX | controller returns zero-filled series (count=0 every day) | progress-chart.tsx:40–46 `allZero` branch shows "Bắt đầu học để xem tiến độ" — no chart, no crash | PASS |

### Feature 5 — SRS (SM-2)

| # | Boundary | Producer (backend) | Consumer (frontend) | Verdict |
|---|----------|--------------------|--------------------|---------|
| 5-1 | Prisma schema has SRS fields | schema.prisma:70–73 `interval Int @default(1)`, `easeFactor Float @default(2.5) @map("ease_factor")`, `nextReviewAt DateTime? @map("next_review_at")`, `repetitions Int @default(0)` | — | PASS |
| 5-2 | SRS index for due-card queries | schema.prisma:82 `@@index([userId, nextReviewAt])` | — | PASS |
| 5-3 | Migration SQL matches schema | migrations/20260610000000_srs_fields/migration.sql:4–11 adds the 4 columns with the same defaults + the same index name `flashcard_progress_user_id_next_review_at_idx`; idempotent (`IF NOT EXISTS`) | — | PASS (file present; `prisma migrate deploy` happens at deploy — see UNVERIFIED-1 below) |
| 5-4 | PUT /api/flashcards/:id/progress accepts optional `quality` | topicController.ts:78–81 `progressSchema = z.object({ known: z.boolean(), quality: z.number().int().min(0).max(5).optional() })`; :148 `quality = body.quality ?? 3` | useTopics.ts:36–47 `markFlashcard(id, known, quality?)` includes `quality` only when caller passes a number | PASS — additive, v2 callers (`{known}` only) still work |
| 5-5 | Response includes `nextReviewAt: string \| null` | topicController.ts:189–194 `{ flashcardId, known, updatedAt: ISO, nextReviewAt: row.nextReviewAt ? row.nextReviewAt.toISOString() : null }` | types.ts:183–188 `FlashcardProgressResponse { flashcardId, known, updatedAt, nextReviewAt?: string \| null }` | PASS — types match; field is optional in TS (consumers don't depend on it) |
| 5-6 | Quality mapping in review session | — | review/page.tsx:89 `const quality = known ? 4 : 2;` and :100 `await markFlashcard(id, known, quality)` | PASS |
| 5-7 | Standard topic page omits quality (default 3) | — | topics/[slug]/page.tsx:115 `await markFlashcard(id, known)` (2 args, quality undefined) → useTopics.ts:42 only adds `quality` when it's a number → body is `{ known }` | PASS — backend defaults quality=3 (controller.ts:148) |
| 5-8 | GET /api/topics/:slug/review route exists | topicRoutes.ts:16 `router.get("/:slug/review", requireAuth, asyncHandler(getTopicReview))` mounted on `/api/topics`. Sits BEFORE `/:slug/progress/reset` (POST) so no method/path collision; sits AFTER `/:slug` (GET) but the `/review` suffix disambiguates. | useTopicReview.ts:12 GET `/api/topics/${slug}/review` | PASS |
| 5-9 | Review response shape | topicController.ts:295–299 `{ items, total: items.length, dueCount: items.length }` where items = `Flashcard[]` via `toFlashcard(card, known)` | types.ts:191–195 `TopicReviewResponse { items: Flashcard[]; total: number; dueCount: number }`; useTopicReview.ts:9 generic = `TopicReviewResponse` | PASS — matches contract §639 exactly |
| 5-10 | `dueCount === total` (badge alias) | controller.ts:297–298 both set to `items.length` | topics/[slug]/page.tsx:50 reads `review?.dueCount ?? 0` for the badge; review/page.tsx:139 `data.dueCount === 0` for empty branch | PASS |
| 5-11 | Public Flashcard shape only — SRS internals not leaked | controller.ts:290–293 maps through `toFlashcard(card, known)` — no `interval/easeFactor/repetitions/nextReviewAt` selected onto items | — | PASS — contract §647 honored |
| 5-12 | Due-card ordering: nextReviewAt ASC NULLS FIRST, then order | controller.ts:275–288 sort: null first, then nextReviewAt ascending, then `Flashcard.order`, then createdAt tiebreaker | review/page.tsx:48 sets `cards = data.items` in receive order — server-decided | PASS |
| 5-13 | `/topics/[slug]/review/page.tsx` exists | — | src/app/(app)/topics/[slug]/review/page.tsx — present; build emits `ƒ /topics/[slug]/review` | PASS |
| 5-14 | Reset clears SRS fields too | controller.ts:215–227 `updateMany { known:false, interval:1, easeFactor:2.5, repetitions:0, nextReviewAt:null }` | topics/[slug]/page.tsx:132–143 calls `resetTopicProgress(slug)` and locally sets cards `known:false` — UI doesn't need to read SRS fields, no UI gap | PASS — cards re-enter the due queue immediately since `nextReviewAt:null` is "NULLS FIRST" |
| 5-15 | Badge link target matches review page route | topics/[slug]/page.tsx:181 `<Link href={\`/topics/${slug}/review\`}>` | review/page.tsx route at `/topics/[slug]/review` | PASS |
| 5-16 | Empty due-queue UX | controller returns empty `items` and `dueCount: 0` | review/page.tsx:139–155 renders 🎉 "Không có thẻ nào cần ôn hôm nay" | PASS |

### Feature 8 — Reading highlight → Vocabulary

| # | Boundary | Producer (UI) | Consumer (API contract / backend) | Verdict |
|---|----------|---------------|----------------------------------|---------|
| 8-1 | Reading page wires selection handling | reading/[slug]/page.tsx:127 wraps the passage in `<div ref={passageRef}>`; :134–138 `<SelectionPopover containerRef={passageRef} enabled={!result} passageText={data.passage}/>` | — | PASS |
| 8-2 | SelectionPopover component exists | src/components/selection-popover.tsx — present; mouseup handler attaches/detaches based on `enabled`, only 1–5 word selections inside the container fire | — | PASS |
| 8-3 | Custom absolute popover doesn't conflict with layout | selection-popover.tsx:170–175 `position: absolute; top/left from Range.getBoundingClientRect() + window.scrollY/X; transform translate(-50%,-100%); z-50` — passage Card uses default flow, no `position: relative` parent intercepts; absolute against the document, anchored above selection rectangle | — | PASS — no positional conflicts; popover hovers above passage |
| 8-4 | Disabled after submit (review mode) | reading/[slug]/page.tsx:136 `enabled={!result}`; when `result` is non-null (after submit) the popover effect short-circuits (selection-popover.tsx:40–44 clears state and skips listener) | — | PASS |
| 8-5 | Dismiss path: outside click, ✕, collapsed selection | popover.tsx:50–66 collapsed selection clears; :118–122 `dismiss()` on ✕; :94–116 mousedown handler dismisses on outside click iff selection collapsed | — | PASS |
| 8-6 | POST /api/vocabulary body — `word` populated | popover.tsx:129,150 `createVocabulary({ word, meaning, …optional })` calling existing `POST /api/vocabulary` hook (no new endpoint — contract §641–642) | — | PASS — feature is correctly client-only |
| 8-7 | POST body — `meaning` non-empty per contract | popover.tsx:131 `const input: VocabularyInput = { word, meaning: word };` — seeds `meaning` with the word itself, then optionally overwrites at :134 from the dictionary fill. The 1–5 word selection guard at :61–66 ensures `word` is non-empty. | api-contract.md POST /api/vocabulary (line 416): `meaning: string (non-empty)`; vocabularyController.ts:17 zod `meaning: z.string().trim().min(1)` — now satisfied unconditionally. | PASS (was FAIL on first pass; fixed by frontend-engineer 2026-06-10) |
| 8-8 | exampleSentence fallback uses passage sentence | popover.tsx:136–141 `findSentence(passageText, word)` — coarse `[.!?]` split; sentence containing the word, lowercased compare | contract: `exampleSentence?: string` (optional, free text) | PASS — optional, only set when found |
| 8-9 | Type alignment to contract VocabularyInput | popover.tsx:129 `const input: VocabularyInput = …` | types.ts:135–146 `VocabularyInput` (word, meaning required; rest optional) — matches contract POST body | PASS (modulo 8-7 runtime issue) |
| 8-10 | No new backend endpoint | — | grep: no new route, no new controller for "highlight/popover/select" — only existing `POST /api/vocabulary` from popover.tsx:150 | PASS — matches contract decision §642,649 |

### Cross-cutting boundary checks

| # | Check | Result |
|---|-------|--------|
| X-1 | Endpoint↔hook 1:1 — no orphans | New endpoints `GET /api/dashboard/progress-history`, `GET /api/topics/:slug/review` each have exactly one hook (`useProgressHistory`, `useTopicReview`). Updated `PUT /api/flashcards/:id/progress` continues to be called by `markFlashcard`. No dangling hooks. PASS |
| X-2 | Contract crosscheck table updated | api-contract.md lines 582,584,586 list `/topics/[slug]/review`, `GET /api/topics/:slug/review`, `GET /api/dashboard/progress-history` consumers. PASS |
| X-3 | Backend `npx tsc --noEmit` | exit 0. PASS |
| X-4 | Frontend `npx tsc --noEmit` | exit 0. PASS |
| X-5 | Frontend `npm run build` | compiled successfully, 14 routes generated incl. `/topics/[slug]/review`. PASS |
| X-6 | Casing: backend response uses camelCase (`nextReviewAt`, `dueCount`; `ease_factor` only internal) | All wire fields are camelCase, no snake_case leak. PASS |
| X-7 | Wrapper agreement (list endpoints) | progress-history uses `{items,total}` (controller :134), useProgressHistory typed as `ListResponse<ProgressHistoryItem>`, chart reads `data.items`. Topic review uses `{items,total,dueCount}`, useTopicReview typed as `TopicReviewResponse`, review page reads `data.items`/`data.dueCount`. PASS |
| X-8 | State transitions: SRS reset clears all 4 fields, due re-queue picks up immediately (NULLS FIRST) | controller.ts:215–227 + 270 `if (p.nextReviewAt === null) return true` and sort puts nulls first. Behavior coherent: a reset card is immediately due in the review queue. PASS |
| X-9 | Auth on new endpoints | dashboardRoutes.ts:12 `requireAuth`; topicRoutes.ts:16 `requireAuth`. PASS |

### UNVERIFIED

1. **`prisma migrate deploy` actually runs the `20260610000000_srs_fields` migration in prod.** The SQL is correct and idempotent (`IF NOT EXISTS`), but at the time of this audit `DATABASE_URL` is not set locally. Deferred to the deploy step (task #5).

### FAIL list

None (post-fix). The first-pass `selection-popover.tsx:129 meaning: ""` issue is resolved at `selection-popover.tsx:131 meaning: word`.

### Conclusion (final)
All 36 verified boundaries for Features 4 (Progress chart), 5 (SRS), and 8 (Reading highlight → Vocabulary) PASS — including the higher-risk cases: additive optional `quality` on the existing flashcard-progress endpoint with backwards-compatible default 3; `nextReviewAt` null-handling on the wire; `dueCount` as a `total` alias on the review wrapper; SRS internals (`interval`/`easeFactor`/`repetitions`/`nextReviewAt`) NOT leaked onto the public `Flashcard` shape served by `/api/topics/:slug/review`; reset clearing all 4 SRS fields so cards re-enter the queue via the NULLS-FIRST sort; the `{items,total,dueCount}` review wrapper correctly unwrapped on both sides; the zero-filled `YYYY-MM-DD` UTC calendar series for the progress chart (which `formatTick` parses with `split("-")`); the `days ∈ {7,30}` allowlist mirrored on both sides by `useState<Window>("7")`; and the post-fix SelectionPopover guaranteeing a non-empty `meaning` even when the client-side dictionary lookup fails. Build + typechecks pass on both sides. Only outstanding item is UNVERIFIED-1 (the SRS migration's `prisma migrate deploy` step on the prod database), which is deferred to task #5. **Gate: PASS — clear to deploy.**

---

## Feature 7 QA — User-created Topics & Flashcards (v4)

Verified 2026-06-10 against `api-contract.md` v4, backend (`server/src/...`) and frontend (`src/...`).

### Cross-boundary results (PASS / FAIL / UNVERIFIED)

| # | Boundary | Producer (backend) | Consumer (frontend) | Status |
|---|----------|--------------------|---------------------|--------|
| 1 | `TopicSummary.userId: string \| null` and `TopicDetail.userId` wire shape | `server/src/lib/serializers.ts:42` (`userId: t.userId ?? null`); `server/src/controllers/topicController.ts:74` (TopicDetail includes `userId: topic.userId ?? null`) | `src/lib/types.ts:35` (`userId: string \| null` on TopicSummary); `src/lib/types.ts:48` (TopicDetail extends TopicSummary → inherits `userId`) | PASS |
| 2a | `POST /api/topics` route mounted + auth | `server/src/routes/topicRoutes.ts:19` (`router.post("/", requireAuth, ...)`) | n/a | PASS |
| 2b | `POST /api/topics` validates title/titleVi 1–80 trimmed | `server/src/controllers/topicController.ts:240-244` zod schema with `.trim().min(1).max(80)` | `src/app/(app)/topics/new/page.tsx:29-36` form mirrors validation (trim+len≤80) | PASS |
| 2c | `POST /api/topics` slugifies + dedups | `server/src/controllers/topicController.ts:280-300` (`slugify` strips diacritics → `-`, `uniqueSlug` appends `-2..-100`) | n/a | PASS |
| 2d | `createTopic()` hook POSTs correct path/body | n/a | `src/hooks/useTopics.ts:62-68` (`POST /api/topics`, body `{title, titleVi, description?}`) | PASS |
| 3a | `PUT /api/topics/:slug` 403 guard `topic.userId === req.user.id` | `server/src/controllers/topicController.ts:342-344` (rejects when `userId === null` OR `userId !== req.userId`) | n/a | PASS |
| 3b | `updateTopic()` hook PUTs correct path | n/a | `src/hooks/useTopics.ts:71-79` (`PUT /api/topics/${encodeURIComponent(slug)}`) | PASS |
| 4a | `DELETE /api/topics/:slug` cascade order progress → flashcards → topic, single transaction | `server/src/controllers/topicController.ts:383-389` (`prisma.$transaction([flashcardProgress.deleteMany, flashcard.deleteMany, topic.delete])`) — across ALL users per contract §319 | n/a | PASS |
| 4b | `deleteTopic()` hook DELETEs correct path | n/a | `src/hooks/useTopics.ts:82-87` (`DELETE /api/topics/${encodeURIComponent(slug)}`) | PASS |
| 5a | `POST /api/topics/:slug/flashcards` returns `Flashcard` with `known:false` | `server/src/controllers/topicController.ts:427` (`res.status(201).json(toFlashcard(card, false))`) | n/a | PASS |
| 5b | `addFlashcard()` hook POSTs to correct path | n/a | `src/hooks/useTopics.ts:90-98` (`POST /api/topics/${slug}/flashcards`) | PASS |
| 5c | Order computed server-side as `max+1` | `server/src/controllers/topicController.ts:411-415` (`aggregate _max.order`, `nextOrder = max + 1` or `0`) | n/a | PASS |
| 6a | `PUT /api/flashcards/:id` checks parent topic ownership | `server/src/controllers/topicController.ts:439-448` (loads card with `topic.userId`, throws 403 if `topic.userId === null \|\| !== req.userId`) | n/a | PASS |
| 6b | `updateFlashcard()` hook PUTs correct path | n/a | `src/hooks/useTopics.ts:101-109` (`PUT /api/flashcards/${encodeURIComponent(id)}`) | PASS |
| 7a | `DELETE /api/flashcards/:id` deletes progress rows first, transactional | `server/src/controllers/topicController.ts:487-490` (`prisma.$transaction([flashcardProgress.deleteMany({where:{flashcardId}}), flashcard.delete])`) — across ALL users per contract §400 | n/a | PASS |
| 7b | `deleteFlashcard()` hook DELETEs correct path | n/a | `src/hooks/useTopics.ts:112-117` (`DELETE /api/flashcards/${encodeURIComponent(id)}`) | PASS |
| 8 | `/topics/new` page exists + renders form | n/a | `src/app/(app)/topics/new/page.tsx:21-131` (form with title/titleVi/description, calls `createTopic`, redirects to `/topics/${slug}/manage`) | PASS |
| 9a | `/topics/[slug]/manage` page exists | n/a | `src/app/(app)/topics/[slug]/manage/page.tsx:40-214` | PASS |
| 9b | `/topics/[slug]/manage` ownership guard (userId check) | n/a | `src/app/(app)/topics/[slug]/manage/page.tsx:54-65` (`if (!me \|\| data.userId !== me.id) { toast.error; router.replace("/topics") }`); UI gated on `ownershipChecked` (line 127) | PASS |
| 10a | `/topics/[slug]/edit` page exists | n/a | `src/app/(app)/topics/[slug]/edit/page.tsx:38-246` | PASS |
| 10b | `/topics/[slug]/edit` has delete danger zone | n/a | `src/app/(app)/topics/[slug]/edit/page.tsx:199-243` (red-bordered Card, `Dialog`-confirmed `handleDelete` → `deleteTopic(slug)`) | PASS |
| 10c | `/topics/[slug]/edit` ownership guard | n/a | `src/app/(app)/topics/[slug]/edit/page.tsx:55-68` same pattern as `/manage` | PASS |
| 11a | `/topics` list page has "Tạo topic mới" button | n/a | `src/app/(app)/topics/page.tsx:33-38` (top-bar Button → `/topics/new`); also empty-state CTA lines 55-62 | PASS |
| 11b | `/topics` per-owner manage links | n/a | `src/app/(app)/topics/page.tsx:69, 77-88` (`isOwner = userId !== null && t.userId === userId`; Settings-icon Link rendered only when `isOwner`) | PASS |
| 12 | `/topics/[slug]` study page shows "Quản lý thẻ" for owners | n/a | `src/app/(app)/topics/[slug]/page.tsx:66, 205-212` (`isOwner = data.userId === userId`; outline Button → `/topics/${slug}/manage` rendered only when `isOwner`) | PASS |
| B1 | Bonus — `GET /api/dashboard` `topicProgress.items[*]` carry `userId` | `server/src/controllers/dashboardController.ts:25-27` reuses `toTopicSummary` serializer which emits `userId` | `src/lib/types.ts:224` `topicProgress: ListResponse<TopicSummary>` already typed with `userId` | PASS |

### Auxiliary checks

| # | Check | Result |
|---|-------|--------|
| AUX-1 | Backend `npx tsc --noEmit` | exit 0. PASS |
| AUX-2 | Frontend `npx tsc --noEmit` | exit 0. PASS |
| AUX-3 | Prisma migration is idempotent | `server/prisma/migrations/20260610010000_user_topics/migration.sql:5,8-18,21` uses `ADD COLUMN IF NOT EXISTS`, `DO $$ ... IF NOT EXISTS` constraint guard, `CREATE INDEX IF NOT EXISTS`. PASS |
| AUX-4 | Prisma schema matches | `server/prisma/schema.prisma:40,45,47` declares `userId String? @map("user_id")`, `user User? @relation(...) onDelete: SetNull`, `@@index([userId])`. Matches migration SQL and contract semantics (seeded rows keep `userId = null`). PASS |
| AUX-5 | Route mount + auth on new endpoints | `server/src/app.ts:30-31` mounts `/api/topics` and `/api/flashcards`; all 6 new routes use `requireAuth` (`topicRoutes.ts:19,21,22,25`; `flashcardRoutes.ts:13,14`). PASS |
| AUX-6 | `403 FORBIDDEN` error code wired | `server/src/lib/errors.ts:7,17` adds `"FORBIDDEN"` to `ErrorCode` with HTTP 403. All 6 ownership checks throw `new AppError("FORBIDDEN", ...)`. PASS |
| AUX-7 | Endpoint↔hook 1:1 (no orphans) | All 6 v4 backend endpoints have exactly one frontend caller in `src/hooks/useTopics.ts`; all 6 v4 frontend callers target a real backend route. PASS |
| AUX-8 | Wire response shapes match contract | `POST /api/topics` → `TopicSummary` single object (line 323); `PUT /api/topics/:slug` → `TopicSummary` (line 364); `DELETE` → `{success:true}` (lines 391, 492); `POST /:slug/flashcards` → `Flashcard` (line 427); `PUT /api/flashcards/:id` → `Flashcard` (line 465). All single objects (NOT list-wrapped) per contract. PASS |
| AUX-9 | Patch semantics on PUT endpoints | `updateTopic` (controller.ts:346-353) and `updateFlashcard` (controller.ts:450-453) only set fields when `body.X !== undefined`. zod `.refine` (lines 252-258, 272-278) requires at least one field. PASS |
| AUX-10 | Slugify handles Vietnamese diacritics | `slugify()` (controller.ts:280-287) uses `.normalize("NFKD").replace(/\p{Diacritic}/gu, "")` then collapses non-`[a-z0-9]` to `-`. Matches contract §263. PASS |

### FAIL

None.

### UNVERIFIED

1. **Runtime 403 vs 404 distinction not exercised end-to-end** — code review confirms `topic.userId === null` (seeded) and `topic.userId !== req.userId` (non-owner) both throw `AppError("FORBIDDEN", ...)` → 403, while unknown slug throws `AppError("NOT_FOUND", ...)` → 404. No live integration harness was run to hit the endpoints with seeded/other-user fixtures; deferred to deploy smoke (task #5).
2. **`prisma migrate deploy` on prod database** — migration SQL is idempotent and locally clean, but `DATABASE_URL` is not set in this QA environment. Deferred to task #5.

### Conclusion

All 27 verified Feature 7 boundaries PASS, including the high-risk ones: (a) `userId: string | null` propagates correctly from Prisma → `toTopicSummary` serializer → wire → `TopicSummary`/`TopicDetail` types → both list page (gating the `Settings2` icon) and study page (gating the `Quản lý thẻ` button) and `/manage` + `/edit` ownership guards; (b) uniform `403 FORBIDDEN` on seeded (`userId === null`) and non-owner (`userId !== req.userId`) mutations across all 5 mutation endpoints (`PUT /topics/:slug`, `DELETE /topics/:slug`, `POST /topics/:slug/flashcards`, `PUT /flashcards/:id`, `DELETE /flashcards/:id`); (c) transactional cascade deletes in the contract-mandated order (progress → flashcards → topic; progress → flashcard) covering all users' progress rows, not just the owner's; (d) server-side slugify with diacritic-strip + `-2..-100` dedup; (e) server-side `max(order)+1` append-only ordering; (f) patch semantics (only-provided-fields-update) on both PUT endpoints with zod `.refine` requiring at least one field; (g) frontend ownership guards on `/manage` and `/edit` use `getStoredUser().id === data.userId` and `router.replace("/topics")` on mismatch, gating UI behind `ownershipChecked`; (h) endpoint↔hook 1:1 with no orphans; (i) bonus dashboard `topicProgress.items[*].userId` is emitted via the shared serializer. Backend + frontend typechecks both exit 0. **Gate: PASS — clear to deploy.** Only outstanding items are UNVERIFIED-1 (live 403/404 distinction) and UNVERIFIED-2 (prod migration deploy), both naturally exercised in task #5.
