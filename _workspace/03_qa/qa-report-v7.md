# QA Report v7 — SRS 4-button + Streak/XP + Sentence Mining
Status: PASS
Date: 2026-06-13

## Boundary 1 — PUT /api/flashcards/:id/progress: PASS

Producer: `server/src/controllers/topicController.ts:124-301`
Consumer: `src/hooks/useTopics.ts:62-71`, `src/app/(app)/topics/[slug]/review/page.tsx:91-108`, `src/app/(app)/topics/[slug]/page.tsx:117-135`

- Backend `progressSchema` (topicController.ts:124) accepts `{ known: boolean, quality?: integer ∈ [0,3] }`. Wire quality outside 0..3 → `400 VALIDATION_ERROR` (zod `.min(0).max(3)`). Matches contract v7.
- Wire→SM-2 mapping at `gamification.ts:17-28`: 0→0, 1→3, 2→4, 3→5. Matches contract.
- Default quality (omitted body) → `wireQuality = 2` (Good), mapping to SM-2 4 (topicController.ts:200). Matches contract.
- Response shape (topicController.ts:293-300): `{ flashcardId, known, updatedAt, nextReviewAt, xpEarned, newStreak }`. Matches `FlashcardProgressResponse` in `src/lib/types.ts:251-258`.
- Frontend `markFlashcard(id, quality: 0|1|2|3)` sends `{ known: quality >= 2, quality }`. Both fields are present, both are valid wire types. The `known` derivation matches the contract's "known=true on Good/Easy" convention.
- Review page (`review/page.tsx:103-107`) reads `res.xpEarned` and `res.newStreak` and surfaces them in the toast + feedback strip — fields are present on the response by both sides.
- Topic detail toggle (`topics/[slug]/page.tsx:135`) maps `known→2`, `unknown→0` — both in-range; no legacy boolean-only body remains.

## Boundary 2 — GET /api/dashboard: PASS

Producer: `server/src/controllers/dashboardController.ts:11-107`
Consumer: `src/hooks/useDashboard.ts`, `src/app/(app)/dashboard/page.tsx:68-86`

- Backend response adds `dueToday`, `streak`, `totalXP`, `badges[]` (dashboardController.ts:78-106) alongside existing `totals/topicProgress/recentAttempts`.
- Frontend `DashboardResponse` (types.ts:290-299) declares all four new fields — `streak: number`, `totalXP: number`, `dueToday: number`, `badges: Badge[]`.
- Dashboard page reads `data.dueToday`, `data.streak`, `data.totalXP`, `data.badges` — all present.
- `dueToday` is language-scoped (Prisma filter `flashcard: { topic: { language } }` at dashboardController.ts:54-62); `streak`/`totalXP`/`badges` are lifetime/language-agnostic. Matches contract.
- `dueToday` includes never-reviewed cards (computed as `totalCardsInLanguage - notDueProgressCount`, so a card with no progress row is implicitly due). Matches contract.

## Boundary 3 — POST /api/vocabulary/mine: PASS

Producer: `server/src/controllers/vocabularyController.ts:273-331`, route at `server/src/routes/vocabularyRoutes.ts:22`
Consumer: `src/hooks/useVocabulary.ts:109-116`, `src/components/selection-popover.tsx:141`

- Backend `mineSchema` requires `word` (trimmed, non-empty) and `exampleSentence` (trimmed, non-empty); `language` optional → resolves via `resolveCreateLanguage` (403 `LANGUAGE_NOT_SELECTED` if user.language null and body omits). Matches contract.
- Backend response: `201 { item: VocabularyEntry }` (vocabularyController.ts:330). Matches contract's `{ item: VocabularyEntry }` wrapper.
- Frontend `MineVocabularyInput` (types.ts:303-307) — `{ word, exampleSentence, language: Language }` — `language` is required by the frontend type even though the backend treats it as optional. This is intentional per frontend report (reading screen passes `data.language`, not `user.language`). No mismatch — frontend is stricter, backend accepts it.
- Frontend `MineVocabularyResponse` (types.ts:309-312) typed as `{ item: VocabularyEntry }`, matching backend.
- Route registered before `/:id` (vocabularyRoutes.ts:22) so it does not get captured as an id param.
- Backend derives mined topic slug as `__mined__-<userId>` rather than literal `__mined__` (explained in vocabularyController.ts:268-272). Frontend does not special-case this slug anywhere — no UI code path depends on the literal `__mined__`. Note: this is a documented deviation from the contract's "slug: __mined__"; behavior from caller's perspective is identical.

## Boundary 4 — User type with streak/XP/badges: PASS

Producer: `server/src/lib/serializers.ts:28-41` (`toUser`), called from `authController.ts:38/63/77`
Consumer: `src/lib/types.ts:27-38` (User), `src/hooks/useAuth.ts` (consumes /me)

- Backend `toUser` emits `streak`, `lastStudiedAt` (ISO string | null), `totalXP`, `badges: Badge[]`. Matches contract.
- Frontend `User` type has `streak: number`, `lastStudiedAt: string | null`, `totalXP: number`, `badges: Badge[]` (types.ts:34-37). Field-for-field match.
- Badge shape on both sides:
  - Backend `toBadge` (gamification.ts:120-127) → `{ id: BadgeId, label: BADGE_LABELS[id], earnedAt: ISO }`.
  - Frontend `Badge` (types.ts:21-25) → `{ id: string, label: string, earnedAt: string }`.
  - Match (frontend `id` widens to `string` since contract enumerates the literal; both interpretations satisfy the contract).
- `GET /api/auth/me` (`authController.ts:68-78`) loads badges via `prisma.earnedBadge.findMany` and wraps with `toUser(user, badges)`. Login does the same (authController.ts:57-63); register passes `[]` (authController.ts:38) — matches contract's "always [] on register" rule.
- `PUT /api/users/me/language` also returns the same `toUser` shape (userController) — covered, no v7-specific issue.

## Boundary 5 — Review page UX: PASS

Files: `src/app/(app)/topics/[slug]/review/page.tsx`, `src/hooks/useTopics.ts`

- Review page imports `markFlashcard` and `SrsQuality` from `useTopics.ts:9` and calls `rate(quality: SrsQuality)` (review/page.tsx:91).
- `markFlashcard(id, quality)` (useTopics.ts:62-71) sends `{known: quality >= 2, quality}` — no boolean-only body remains.
- Topic detail page (`topics/[slug]/page.tsx:135`) maps `known→2`, `unknown→0` — only place outside of the review page that hits `/progress`. No stale `known: boolean` call sites.
- Toast + feedback consume `res.xpEarned` and `res.newStreak` (review/page.tsx:105-107). Response types include both — no `as` cast required; clean typecheck.
- `AuthContext.refresh()` invoked after each rating (per frontend report) so new badges propagate to TopNav/dashboard.
- Frontend `npx tsc --noEmit` exits 0.
- Backend `npx tsc --noEmit` exits 0.

## Summary
5/5 boundaries PASS
Blockers: none

Notes:
- Documented contract deviation: mined topic slug is `__mined__-<userId>` (per-user) rather than literal `__mined__`. Backend explained the rationale (schema's `@@unique([slug, language])` is global, so two users cannot share the literal slug). No frontend code depends on the literal slug, so this is invisible from the wire boundary. If a future feature special-cases the slug in UI it should match the `__mined__-` prefix.
- Frontend `MineVocabularyInput.language` is required even though backend marks it optional — intentional per design (mining passes the *reading screen's* language, not the user's). Stricter on the producer side; backend tolerates it.
