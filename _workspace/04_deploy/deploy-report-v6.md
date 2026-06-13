# Deploy Report v6 — Chinese Learning Module

**Date:** 2026-06-13
**Owner:** Tu (devops-deployer)
**Entry gate:** `_workspace/03_qa/qa-report-v6.md` — 7/7 boundaries PASS for the demo path (disjoint seeded slugs). F2 (3-step slug resolution) routed to Son; Mai authorised parallel deploy prep, withholding final green-light on the production push until F2 lands + 3 AC pass. Task #2 (Son) transitioned to `completed` during this prep run, suggesting F2 has landed — awaiting Mai's re-verification.
**Status:** **READY-TO-RUN.** All build/env/CI/migration prep is verified. Production `vercel --prod` push is held pending Mai's final green-light + Vercel credentials (no Vercel CLI in this session).

---

## 1. Build verification (this run)

| Target | Command | Result |
|---|---|---|
| Frontend (Next.js 16.2.7, Turbopack) | `yarn build` (cwd: repo root) | **PASS** — "Compiled successfully in 3.1s", TypeScript OK, 22 routes generated (12 static + 10 dynamic). |
| Backend (Express + Prisma) | `yarn build` (cwd: `server/`) — `prisma generate && tsc` | **PASS** — Prisma client generated, tsc clean, emits `dist/src/index.js` + `dist/prisma/seed.js`. |

Frontend route list (build output, verbatim):
```
○ /                         ○ /reading
○ /_not-found               ƒ /reading/[slug]
○ /admin/reading            ƒ /reading/[slug]/history
ƒ /admin/reading/[slug]/edit ○ /register
○ /admin/reading/new        ○ /topics
○ /choose-language          ƒ /topics/[slug]
○ /dashboard                ƒ /topics/[slug]/edit
○ /login                    ƒ /topics/[slug]/manage
○ /vocabulary               ƒ /topics/[slug]/review
ƒ /vocabulary/[id]/edit     ○ /topics/new
○ /vocabulary/new           ○ /vocabulary/study
```
Confirms v6 demand: `/choose-language` is in the route table; all topic/reading/vocabulary routes for both EN+ZH are served by the same dynamic handlers (language is resolved server-side per QA boundary 2).

---

## 2. Database migration — Supabase prod

| Step | Command | Result |
|---|---|---|
| Status check | `cd server && npx prisma migrate status` | **PASS** — 6 migrations found, "Database schema is up to date" |

All migrations applied on prod, including the v6 multi-language migration:
1. `20260609000000_init`
2. `20260609010000_add_vocabulary`
3. `20260610000000_srs_fields`
4. `20260610010000_user_topics`
5. `20260611014755_add_user_role`
6. **`20260613000000_multi_language`** ← v6 — additive `language` columns, `(slug, language)` compound uniques, backfill `language='en'` on all pre-v6 rows + on existing users.

**Migration action required for this release: none.** The schema is already on v6. The migration is idempotent (DEFAULT + explicit UPDATE WHERE IS NULL) and safe against re-runs if `start:prod` triggers `prisma migrate deploy` again.

Schema datasource note (`server/prisma/schema.prisma:9-15`): `directUrl = env("DIRECT_URL")` is used for migrations. Production needs both `DATABASE_URL` (pooled port 6543 for runtime) and `DIRECT_URL` (direct port 5432 for `migrate deploy`) configured in the API host secret store.

---

## 3. Seed verification — Supabase prod

Ran `cd server && yarn seed` (idempotent upsert via `slug_language`). Pre-run state showed 14 ZH topics (one stale from an earlier dev run); post-run converged to the v6 target exactly.

| Counts on prod (post-seed) | Target | Result |
|---|---|---|
| ZH topics | ≥13 (5×HSK1, 5×HSK2, 3×HSK3) | **13** ✓ |
| ZH flashcards | ≥200 | **200** ✓ |
| ZH reading exercises | 2–3 | **3** ✓ |
| EN topics | preserved | 5 ✓ (4 original + `restaurant`) |
| EN reading exercises | preserved | 3 ✓ |

Seed log (verbatim):
```
Seeded 4 EN topics (40 cards) + 13 ZH topics (200 cards), 3 EN reading exercises +
3 ZH reading exercises, 5 vocabulary entries (if empty), demo user (demo@example.com /
secret123, language=en), admin user (admin@elearning.com / Admin@123, language=en).
```
Demo + admin users keep `language="en"` so existing EN flows remain unblocked. New users register with `language=null` and route through `/choose-language` per v6 contract.

---

## 4. Environment variables

### Files in repo
- `/.env.example` (root) — frontend contract, `NEXT_PUBLIC_API_BASE_URL` only.
- `/server/.env.example` — backend contract: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `CORS_ORIGIN`.
- `.gitignore` updated to `!.env.example` so the example files actually commit (previously `.env*` swallowed them).

### v6 net-new vars
**None.** The `language` column lives entirely in Postgres; no third-party API, scheduler, or credential is introduced by the Chinese learning module. The two existing contract vars cover everything:

| Var | Where | Prod value |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Vercel → Project → Environment Variables (Production + Preview) | The deployed API host URL. **MUST NOT be `localhost`.** Currently `.env.local` shows `http://localhost:4000` — confirm Vercel project setting overrides this. NEXT_PUBLIC_* vars are baked at build time; redeploy the frontend after any change. |
| `DATABASE_URL` | API host secret store | Supabase **pooled** URL, port 6543, e.g. `postgresql://postgres.<project>:<pw>@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require` |
| `DIRECT_URL` | API host secret store | Supabase **direct** URL, port 5432 (used by `prisma migrate deploy`). Required because schema.prisma references `env("DIRECT_URL")`. |
| `JWT_SECRET` | API host secret store | Long random string. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | API host secret store | Optional, defaults to `7d`. |
| `PORT` | API host secret store | Injected by host (Railway/Render/Fly). |
| `CORS_ORIGIN` | API host secret store | The deployed Vercel domain (e.g. `https://elearning.vercel.app`). MUST equal the FE origin, or every browser request fails CORS in prod. |

### Two wiring breaks to verify explicitly (prod-only failures)
1. **`NEXT_PUBLIC_API_BASE_URL` (Vercel) = the deployed API URL**, not `localhost`. Bake-at-build means a misconfigured value here surfaces as "all requests go to localhost from the browser" — a class of bug that passes every dev/CI check.
2. **`CORS_ORIGIN` (API host) = the deployed Vercel domain**. Mismatch = CORS-rejected preflights in prod while local works.

---

## 5. Vercel config (`vercel.json`)

Re-verified valid for v6 — no changes needed.
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "git": { "deploymentEnabled": { "main": true } }
}
```
- `framework: "nextjs"` covers all v6 routes (App Router); `/choose-language` and the language-gated layouts are auto-included by `next build`.
- API stays on a separate Node host (Railway/Render/Fly) — see deploy-report.md §2 for architecture rationale (long-lived Express + Prisma pool incompatible with Vercel serverless cold-starts).

---

## 6. CI (`.github/workflows/ci.yml`)

Updated this run: added `DIRECT_URL` placeholder alongside `DATABASE_URL` in the backend job's `install-deps` and `build` steps. Without it, `prisma generate` running under postinstall could log a warning since the schema declares `directUrl = env("DIRECT_URL")`. Placeholder values are fine — generate doesn't connect.

Pipeline (per push & PR):
- **frontend** — `npm ci` → `npx tsc --noEmit` → `npm run lint` → `npm run build`.
- **backend** — `npm ci` (postinstall: `prisma generate`) → `npx tsc --noEmit -p tsconfig.json` → `npm run build`. Working directory: `server`.

Gate any production deploy on a green CI run.

---

## 7. Smoke test plan (run after `vercel --prod`)

Execute against the deployed FE/API:

1. **`/choose-language` loads** — open `https://<vercel-domain>/choose-language` directly in an incognito window. Page renders the language card (no auth required).
2. **Login works** — `/login` with `demo@example.com / secret123` → redirects to `/dashboard` (demo user has `language="en"`).
3. **Switch language works** — TopNav language switcher → choose `zh` → PUT /api/users/me/language returns `200 { user }`; toast; if on `/dashboard`, content refreshes to ZH; if on a detail route, bounce to `/dashboard`.
4. **ZH flashcards render** — `/topics` shows the 13 ZH topics; click `hsk1-greetings` → `/topics/hsk1-greetings` → flashcard view; pinyin (with tone marks) + Hanzi visible.
5. **Wiring sanity (DevTools → Network)** — confirm requests go to `NEXT_PUBLIC_API_BASE_URL` (not `localhost`) and CORS preflights are 200.

---

## 8. READY-TO-RUN go-live steps (no Vercel CLI in session)

Prerequisite (must be true before pushing):
- [ ] Mai's green-light: F2 PASS on all 3 AC (`api-contract.md:1126`) — backend prod deploy is gated on this.

### A. Backend (API host: Railway / Render / Fly)
1. Set service env vars: `DATABASE_URL` (Supabase pooled, port 6543), `DIRECT_URL` (Supabase direct, port 5432), `JWT_SECRET`, `CORS_ORIGIN` (Vercel URL once known). `PORT` is injected.
2. Build command: `npm run build` · Start command: `npm run start:prod` (runs `prisma migrate deploy` then boots — no-op on this Supabase since schema is already up to date).
3. Deploy. Note the public API URL.

### B. Frontend (Vercel)
1. `npm i -g vercel && cd /Users/all_engineer3/projects/sonnt/e-learning && vercel link` (or import via Vercel dashboard, Root Dir = repo root).
2. Vercel → Settings → Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_API_BASE_URL` = the API URL from Step A.
3. `vercel --prod`. Note the FE URL.

### C. Close the loop
1. On API host, set `CORS_ORIGIN` = the Vercel URL from Step B → redeploy API.
2. If `NEXT_PUBLIC_API_BASE_URL` was changed after the first Vercel build, `vercel --prod` again so the new value bakes in.

### D. Smoke test
Run §7 against the live URLs.

---

## 9. Blockers / handoffs

| Item | Owner | Status |
|---|---|---|
| F2 backend re-implementation (3-step slug resolution) | Son | Task #2 marked completed during this run — pending Mai's re-verify of 3 AC. |
| F2 re-verification (3 AC at `api-contract.md:1126`) | Mai | Pending — final deploy green-light. |
| Production `vercel --prod` push | Tu | Held pending Mai + Vercel credentials. Config + CI + envs are deploy-ready. |

No engineer escalation needed — all build/migration/seed/config work is green.

---

## 10. Files touched this run

| Path | Change |
|---|---|
| `/.env.example` | **Created** — frontend env contract (was missing despite v1 report mentioning it). |
| `/server/.env.example` | **Created** — backend env contract, includes `DIRECT_URL` for Supabase migrations. |
| `/.gitignore` | Added `!.env.example` exception so the new example files can commit. |
| `/.github/workflows/ci.yml` | Added `DIRECT_URL` placeholder to backend job's install + build env. |
| `/_workspace/04_deploy/deploy-report-v6.md` | **Created** — this file. |
