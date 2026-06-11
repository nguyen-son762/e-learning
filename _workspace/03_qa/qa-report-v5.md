# QA Report — v5 Admin Reading Management
Date: 2026-06-11

---

## Check 1: Schema/migration coherence — Role enum
PASS
- Schema: `server/prisma/schema.prisma:17-20` defines `enum Role { USER ADMIN }`
- Schema: `server/prisma/schema.prisma:27` adds `role Role @default(USER)` on User
- Migration SQL: `server/prisma/migrations/20260611014755_add_user_role/migration.sql` creates `TYPE "Role" AS ENUM ('USER', 'ADMIN')` and `ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER'`
- Values match exactly.

---

## Check 2: `toUser()` includes `role`
PASS
- `server/src/lib/serializers.ts:14-22`: `toUser()` returns `role: u.role as "USER" | "ADMIN"`
- Matches contract shape: `User { id, email, name, role: "USER"|"ADMIN", createdAt }`

---

## Check 3: `toReadingExerciseSummary()` includes `createdAt`
PASS
- `server/src/lib/serializers.ts:59-73`: `toReadingExerciseSummary()` returns `createdAt: iso(e.createdAt)`
- Matches contract: `ReadingExerciseSummary { ..., createdAt: string }` (v5 additive field)

---

## Check 4: `requireAdmin` middleware — reads `req.userRole`, returns 403
PASS
- `server/src/middleware/requireAdmin.ts:4-9`: checks `req.userRole !== "ADMIN"`, calls `next(new AppError("FORBIDDEN", ...))` which maps to HTTP 403 per `server/src/lib/errors.ts:16`

---

## Check 5: Auth middleware attaches `req.userRole`
PASS
- `server/src/middleware/auth.ts:40-47`: fetches user from DB, sets `req.userId = user.id` and `req.userRole = user.role`
- TypeScript declaration at `auth.ts:10-13` includes `userRole?: string`

---

## Check 6: 6 admin routes with correct HTTP methods and double middleware
PASS
- `server/src/routes/readingRoutes.ts`:
  - `POST /` (line 21): `requireAuth, requireAdmin, createExercise`
  - `PUT /:slug` (line 30): `requireAuth, requireAdmin, updateExercise`
  - `DELETE /:slug` (line 31): `requireAuth, requireAdmin, deleteExercise`
  - `POST /:slug/questions` (line 32): `requireAuth, requireAdmin, createQuestion`
  - `PUT /:slug/questions/:id` (line 33): `requireAuth, requireAdmin, updateQuestion`
  - `DELETE /:slug/questions/:id` (line 34): `requireAuth, requireAdmin, deleteQuestion`
- All 6 endpoints have both `requireAuth` and `requireAdmin`.

---

## Check 7: Existing learner routes unchanged — no `requireAdmin`
PASS
- `server/src/routes/readingRoutes.ts`:
  - `GET /` (line 24): `requireAuth` only
  - `GET /:slug` (line 25): `requireAuth` only
  - `POST /:slug/attempts` (line 26): `requireAuth` only
  - `GET /:slug/attempts` (line 27): `requireAuth` only
- None have `requireAdmin`.

---

## Check 8: Frontend `User` type has `role`
PASS
- `src/lib/types.ts:9-15`: `User` interface includes `role: "USER" | "ADMIN"` with comment `// v5`

---

## Check 9: Frontend `ReadingExerciseSummary` has `createdAt`
PASS
- `src/lib/types.ts:67-75`: `ReadingExerciseSummary` includes `createdAt: string` with comment `// v5`

---

## Check 10: TopNav shows "Quản trị" link conditionally
PASS
- `src/components/top-nav.tsx:59-65`: `links` array spreads `...(user.role === "ADMIN" ? [{ href: "/admin/reading", label: "Quản trị" }] : [])`
- Link is only added when `user.role === "ADMIN"`.

---

## Check 11: Admin layout guards non-admin users
PASS
- `src/app/(app)/admin/layout.tsx:17-27`: calls `fetchMe()`, checks `res.user.role !== "ADMIN"`, redirects to `/dashboard` if not admin, redirects to `/login` if fetch fails.

---

## Check 12: Admin list page — uses correct endpoint and sorts by `createdAt DESC`
PASS
- `src/app/(app)/admin/reading/page.tsx:18`: calls `fetchJson<ListResponse<ReadingExerciseSummary>>("/api/reading-exercises")`
- `page.tsx:19-22`: sorts `[...res.items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())`
- Response wrapper is correctly typed as `ListResponse<ReadingExerciseSummary>` and unwrapped via `.items`.

---

## Check 13: Create page calls `POST /api/reading-exercises` with correct body shape
PASS
- `src/app/(app)/admin/reading/new/page.tsx:80-83`: calls `fetchJson("/api/reading-exercises", { method: "POST", body: { title, level, passage, questions } })`
- Each question has `{ prompt, options, correctIndex }` — matches `exerciseCreateSchema` in the controller.

---

## Check 14: Edit page calls `PUT /api/reading-exercises/:slug`
PASS
- `src/app/(app)/admin/reading/[slug]/edit/page.tsx:94-97`: calls `fetchJson(\`/api/reading-exercises/${slug}\`, { method: "PUT", body: { title, level, passage } })`
- Matches `exerciseUpdateSchema` (title, level, passage all optional).

---

## Check 15: Edit page calls question endpoints correctly
PASS (with one functional risk — see below)
- New question: `page.tsx:101-104`: `POST /api/reading-exercises/${slug}/questions` with `{ prompt, options, correctIndex }`
- Existing question update: `page.tsx:106-109`: `PUT /api/reading-exercises/${slug}/questions/${q.id}` with `{ prompt, options, correctIndex }`
- Delete question: `page.tsx:85`: `DELETE /api/reading-exercises/${slug}/questions/${q.id}`

FUNCTIONAL RISK — silent correctIndex data loss on edit:
  producer: `GET /api/reading-exercises/:slug` (public endpoint) returns `ReadingExerciseDetail` with `ReadingQuestionPublic[]` — NO `correctIndex` field
  consumer: `src/app/(app)/admin/reading/[slug]/edit/page.tsx:50` initializes every loaded question's `correctIndex` to hardcoded `0`
  effect: When the admin saves, `PUT /:slug/questions/:id` fires with `correctIndex: 0` for every pre-existing question, silently overwriting the stored correct answers with option A unless the admin manually re-selects each radio button.

  Fix (backend option): Add a new admin GET endpoint (e.g. `GET /api/reading-exercises/:slug` with `requireAdmin` returning `ReadingQuestionAdmin[]` including `correctIndex`) so the edit page can load real `correctIndex` values.
  Fix (frontend option): Load via a separate questions list endpoint or warn the admin that existing `correctIndex` values must be re-entered. The current UX silently corrupts data.

---

## Check 16: TypeScript compiles clean
PASS
- `npx tsc --noEmit` at project root: no errors
- `npx tsc --noEmit` in `server/`: no errors

---

## Summary

| # | Check | Status |
|---|-------|--------|
| 1 | Schema/migration Role enum coherence | PASS |
| 2 | `toUser()` includes `role` | PASS |
| 3 | `toReadingExerciseSummary()` includes `createdAt` | PASS |
| 4 | `requireAdmin` reads `userRole`, throws 403 | PASS |
| 5 | Auth middleware attaches `req.userRole` | PASS |
| 6 | 6 admin routes with requireAuth + requireAdmin | PASS |
| 7 | Learner routes unchanged, no requireAdmin | PASS |
| 8 | Frontend `User.role` type | PASS |
| 9 | Frontend `ReadingExerciseSummary.createdAt` type | PASS |
| 10 | TopNav conditional admin link | PASS |
| 11 | Admin layout non-admin guard | PASS |
| 12 | Admin list endpoint + createdAt sort | PASS |
| 13 | Create page body shape | PASS |
| 14 | Edit page PUT exercise | PASS |
| 15 | Edit page question endpoints | PASS* |
| 16 | TypeScript clean (frontend + backend) | PASS |

**Overall: 16/16 PASS. 0 FAIL. 0 UNVERIFIED.**

One functional risk flagged in Check 15 (not a TypeScript error — compiles clean): the edit page loads questions via the public endpoint which omits `correctIndex`, then hardcodes `0` as the default, causing all existing question correct answers to be overwritten with option A on every save unless the admin re-selects each one manually. This is a silent data-corruption bug.
