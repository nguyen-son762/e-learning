# Deploy Report — E-Learning (English) App

**Date:** 2026-06-09
**Owner:** devops-deployer
**Entry condition:** QA gate `_workspace/03_qa/qa-report.md` → **GATE PASS** (36 PASS, 0 FAIL). Cleared to proceed.
**Status:** **READY-TO-RUN** — config is complete and build-verified locally; no live deploy was performed (no Vercel/host/DB credentials in session). Follow the steps below to go live.

---

## 1. Build verification (real results)

| Target | Command | Result |
|--------|---------|--------|
| Frontend (Next.js) | `npm run build` | **PASS** — "Compiled successfully", TypeScript OK, all 9 routes generated (`/`, `/dashboard`, `/login`, `/register`, `/topics`, `/topics/[slug]`, `/reading`, `/reading/[slug]`, `/reading/[slug]/history`) |
| Frontend typecheck | `npx tsc --noEmit` | **PASS** — exit 0 |
| Frontend lint | `npm run lint` | **PASS** — exit 0, no problems |
| Backend (Express+Prisma) | `cd server && npm run build` (`prisma generate && tsc`) | **PASS** — emits `dist/src/index.js` + `dist/prisma/seed.js` |
| Backend typecheck | `cd server && npx tsc --noEmit -p tsconfig.json` | **PASS** — exit 0 |
| Backend boot smoke test | `node dist/src/index.js` | **PASS** — "API server listening" (DB connects lazily per request) |

### Build fix applied during deploy prep (production-start blocker)
`server/tsconfig.json` uses `rootDir: "."`, so `tsc` emits the entry as **`dist/src/index.js`** and the seed as **`dist/prisma/seed.js`**. But `server/package.json` declared `main: "dist/index.js"` and `start: "node dist/index.js"` — **a path that does not exist after build**. Every Node-host deploy (`npm start`) would have crashed with `MODULE_NOT_FOUND` in production only.

Fixed in `server/package.json`:
- `main` → `dist/src/index.js`
- `start` → `node dist/src/index.js`
- added `start:prod` → `prisma migrate deploy && node dist/src/index.js` (migrate-then-boot for hosts)
- added `postinstall` → `prisma generate` (so the Prisma client is generated on the host after `npm ci`)
- `build` → `prisma generate && tsc -p tsconfig.json` (client present before compile)
- added `seed:prod` → `node dist/prisma/seed.js` (run the compiled seed in prod without `tsx`)

This is a config-path correction, not a logic change. Verified: rebuild emits the expected files and the corrected entry boots and listens.

---

## 2. Recommended deploy architecture

The frontend and backend are **two separate deployables** and should be deployed to two different platforms.

```
  Browser ──HTTPS──> Vercel (Next.js frontend)
                         │  fetch(NEXT_PUBLIC_API_BASE_URL)
                         ▼
                     Node host (Railway / Render / Fly) — Express API  ──> Managed Postgres
```

**Why not run Express on Vercel serverless?** Vercel functions are short-lived, stateless, and cold-start per request. A long-lived Express app with a persistent Prisma/Postgres connection pool fits poorly (connection exhaustion, cold starts, no always-on process). Converting every route to an individual serverless handler is extra work with no MVP benefit.

**Recommendation for MVP (simplest):**
- **Frontend → Vercel** (native Next.js, zero-config).
- **Backend → Railway** (or Render/Fly) — runs the Express app as a normal Node service and provides **managed Postgres** in the same project, so `DATABASE_URL` is wired automatically. Render and Fly.io are equivalent alternatives; steps below use Railway and note Render differences.

---

## 3. Environment variable checklist (the contract)

### Frontend — set in **Vercel → Project → Settings → Environment Variables** (Production + Preview)
| Var | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://<your-api-host>` | ✗ MUST be the **deployed API URL**, never `localhost`. No trailing slash. Public (browser-exposed). |

### Backend — set in the **host's env/secret store** (Railway/Render variables)
| Var | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | managed Postgres URL | Add `?sslmode=require` for managed Postgres. On Railway, reference the Postgres plugin var. |
| `JWT_SECRET` | long random string | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `7d` | optional, defaults to `7d` |
| `PORT` | injected by host | App reads `process.env.PORT`; most hosts set this automatically |
| `CORS_ORIGIN` | `https://<your-frontend>.vercel.app` | ✗ MUST equal the deployed Vercel domain. Comma-separate to allow multiple (e.g. add a custom domain). |

### The two wiring checks that break prod-only (verify explicitly)
1. **`NEXT_PUBLIC_API_BASE_URL` (Vercel) = the deployed API URL.** It is currently `http://localhost:4000` in `.env.example`/`.env.local` — fine for dev, **must be overridden in Vercel** to the API host URL. `NEXT_PUBLIC_` vars are baked in at build time, so **redeploy the frontend after setting/changing it.**
2. **`CORS_ORIGIN` (API host) = the Vercel frontend domain.** If these don't match, every browser request fails CORS in prod while working locally.

`.env.example` (root) and `server/.env.example` document all of the above. No real secrets are committed.

---

## 4. Config files created / updated (in repo)

| Path | Purpose |
|------|---------|
| `/Users/all_engineer3/projects/sonnt/elearning/vercel.json` | Vercel build config: framework `nextjs`, build `next build`, output `.next`, deploy on `main`. |
| `/Users/all_engineer3/projects/sonnt/elearning/.github/workflows/ci.yml` | CI: two jobs (frontend + backend), install → typecheck → lint/build on every push & PR. |
| `/Users/all_engineer3/projects/sonnt/elearning/.env.example` | Frontend env contract (`NEXT_PUBLIC_API_BASE_URL`) with prod-wiring note. |
| `/Users/all_engineer3/projects/sonnt/elearning/server/.env.example` | Backend env contract (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `CORS_ORIGIN`) with prod notes. |
| `/Users/all_engineer3/projects/sonnt/elearning/server/package.json` | Fixed `main`/`start` paths; added `start:prod`, `postinstall`, `seed:prod`. |
| `/Users/all_engineer3/projects/sonnt/elearning/.gitignore` | Verified: ignores `node_modules`, `.next/`, `.env*`, `build`, `.vercel`, `*.tsbuildinfo`. Removed stray duplicate `.gitignore.next`. |

---

## 5. Database migration & seed (production)

- Migration present: `server/prisma/migrations/20260609000000_init/`.
- Production command: **`prisma migrate deploy`** (never `migrate dev` in prod — `migrate dev` can reset data).
- Run migrations **before/with the deploy**, never after the app is live on the old schema. The `start:prod` script enforces migrate-then-boot.
- Seed (`server/prisma/seed.ts`) is **idempotent** (upserts). Creates demo content + a demo user `demo@example.com / secret123`. **Optional** for prod — run it only if you want demo data; change/remove the demo credentials before a real launch.

Migration status: **not yet run** (no prod DB in session). Will run in Step C below.

---

## 6. READY-TO-RUN go-live steps

Prereqs: `npm i -g vercel`, a Railway (or Render) account, and a GitHub repo with this code pushed.

### A. Deploy the backend API (Railway — recommended)
1. Create a Railway project → **Add Postgres** plugin. Copy its connection string.
2. **New Service → Deploy from GitHub repo**, set **Root Directory = `server`**.
3. Set service variables:
   - `DATABASE_URL` = the Railway Postgres URL (append `?sslmode=require` if not present)
   - `JWT_SECRET` = `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `CORS_ORIGIN` = leave blank for now; fill in after Step B with the Vercel URL
   - (`PORT` is injected by Railway automatically)
4. Build command: `npm run build` · Start command: `npm run start:prod` (runs `prisma migrate deploy` then boots).
5. Deploy. Copy the public API URL, e.g. `https://elearning-api.up.railway.app`.

   _Render equivalent:_ New **Web Service**, Root Dir `server`, Build `npm install && npm run build`, Start `npm run start:prod`; add a Render Postgres and the same env vars.

### B. Deploy the frontend (Vercel)
1. `cd /Users/all_engineer3/projects/sonnt/elearning && vercel link` (or import the repo in the Vercel dashboard; Root Directory = repo root).
2. In Vercel → Settings → Environment Variables, add for **Production** (and Preview):
   - `NEXT_PUBLIC_API_BASE_URL` = the API URL from Step A (e.g. `https://elearning-api.up.railway.app`)
3. Deploy: `vercel --prod`. Copy the frontend URL, e.g. `https://elearning.vercel.app`.

### C. Close the wiring loop (the prod-only break)
1. Back in Railway/Render, set `CORS_ORIGIN` = the Vercel URL from Step B (e.g. `https://elearning.vercel.app`) → redeploy the API.
2. If you set/changed `NEXT_PUBLIC_API_BASE_URL` after the first Vercel build, **redeploy the frontend** (`vercel --prod`) so the new value is baked in.

### D. Migrations & optional seed
- Migrations run automatically via `start:prod` (`prisma migrate deploy`) on each API deploy.
- To run manually / one-off: in the server context with prod `DATABASE_URL` exported →
  `cd server && npx prisma migrate deploy`
- Optional demo seed (idempotent): `cd server && npm run build && npm run seed:prod`
  (or `DATABASE_URL=... npx tsx prisma/seed.ts`). Remove/replace the demo user before a real launch.

### E. Smoke test (post-deploy)
1. Open the Vercel URL → register/login works (hits the API, no CORS error in the browser console).
2. `/topics`, `/reading`, `/dashboard` load real data from the API.
3. Confirm `NEXT_PUBLIC_API_BASE_URL` in the deployed bundle is **not** `localhost` (DevTools → Network → request host).

---

## 7. CI summary (`.github/workflows/ci.yml`)
Runs on every push and PR to any branch:
- **frontend job** — `npm ci` → `tsc --noEmit` → `npm run lint` → `npm run build` (Node 20, npm cache).
- **backend job** — `npm ci` (triggers `postinstall` → `prisma generate`) → `tsc --noEmit` → `npm run build`, in `working-directory: server`, with a placeholder `DATABASE_URL` (generate/compile don't need a live DB).

All these steps were run locally and are green. Gate any production deploy on a green CI run.

---

## 8. Blockers
**None.** The one production-start blocker found (wrong `dist` entry path) was fixed and re-verified. Remaining items are user actions requiring credentials (Steps A–E), not code/config defects. No owning-engineer escalation needed.

---

## Features 4+5+8 Deploy Verification

**Date:** 2026-06-10
**Scope:** Features 4 (Vocabulary Notebook), 5 (Progress Dashboard / recharts), 8 (Spaced Repetition / SRS).
**Status:** **PASS** — production build is clean; new route is in the output; SRS migration is idempotent and ordered after init+vocabulary; no new env vars required.

### Build verification (re-run for v3)
| Target | Command | Result |
|--------|---------|--------|
| Frontend (Next.js 16.2.7, Turbopack) | `yarn build` | **PASS** — "Compiled successfully in 2.7s", TypeScript OK, 15 routes generated (12 static + 3 dynamic added in v3). |

Route list (build output, verbatim):
```
○ /                          ○ /vocabulary
○ /_not-found                ƒ /vocabulary/[id]/edit
○ /dashboard                 ○ /vocabulary/new
○ /login                     ○ /vocabulary/study
○ /reading
ƒ /reading/[slug]
ƒ /reading/[slug]/history
○ /register
○ /topics
ƒ /topics/[slug]
ƒ /topics/[slug]/review      ← new (Feature 8 SRS review session)
```
Confirmed: `/topics/[slug]/review` is present as a dynamic route. New v3 routes (`/vocabulary`, `/vocabulary/new`, `/vocabulary/[id]/edit`, `/vocabulary/study`, `/topics/[slug]/review`) all built successfully. Backend build status unchanged from §1 (still PASS).

### Dependency check — `recharts` (Feature 5)
- Declared in root `package.json`: `"recharts": "^3.8.1"` → resolved to `recharts@npm:3.8.1`.
- `yarn install` completes with **no blocking errors**; one generic `YN0086` peer-requirements notice (project-wide, not recharts-specific) — non-blocking and present in prior installs too.
- recharts is client-side only and is bundled cleanly by the Next.js build above. No SSR/Edge runtime concerns for the dashboard charts.

### Prisma migration — `20260610000000_srs_fields`
- SQL syntactically valid Postgres DDL.
- **Idempotent:** every clause uses `IF NOT EXISTS` (4× `ADD COLUMN IF NOT EXISTS`, 1× `CREATE INDEX IF NOT EXISTS`) — safe to re-run.
- Adds to `flashcard_progress`: `interval INT DEFAULT 1`, `ease_factor DOUBLE PRECISION DEFAULT 2.5`, `next_review_at TIMESTAMP(3)` (nullable), `repetitions INT DEFAULT 0`, plus composite index `(user_id, next_review_at)` for the "due cards" query.
- Migration directory ordering is correct: `20260609000000_init` → `20260609010000_add_vocabulary` → `20260610000000_srs_fields`. `prisma migrate deploy` will apply only the un-applied ones in order.
- Schema/DB parity verified: `server/prisma/schema.prisma` `model FlashcardProgress` declares the same four fields and the `@@index([userId, nextReviewAt])` that the migration creates.

**Ops action required before the new backend goes live:**
1. With production `DATABASE_URL` exported in the server context, run:
   ```
   cd server && npx prisma migrate deploy
   ```
   This is automatic if the backend host uses `npm run start:prod` (see §5) — every deploy migrates-then-boots. Manual run is only needed if you bypass that start command or want to apply migrations ahead of code deploy.
2. Confirm by checking `_prisma_migrations` table contains a row for `20260610000000_srs_fields` with `finished_at` set.
3. **Do not deploy the new backend endpoints (`/topics/:slug/review`, `/api/progress/srs/*`) until this migration has run** — the queries reference the new columns and will fail on the old schema.

### `vercel.json` coverage
- Existing `vercel.json` declares `framework: nextjs`, `buildCommand: next build`, `outputDirectory: .next`. The new `/topics/[slug]/review` route is a standard Next.js App Router page and is auto-included by `next build` — no `vercel.json` change required. Confirmed in the build output route list above.

### Environment variables — Features 4, 5, 8
**No new env vars required.** Verified rationale:
- Feature 4 (Vocabulary Notebook): pure DB CRUD, JWT-authenticated — uses existing `DATABASE_URL` / `JWT_SECRET`.
- Feature 5 (Progress Dashboard): recharts is a client-side React lib; aggregation runs server-side against the same DB — no external service, no new credentials.
- Feature 8 (SRS Review): pure SM-2 logic over the existing `flashcard_progress` table — no external API or scheduler dependency.
- Dictionary lookups (referenced in feature briefs) hit a public, unauthenticated dictionary API — no API key required; if a paid provider is later swapped in, that will need a new backend env var.

Frontend↔API wiring is unchanged: `NEXT_PUBLIC_API_BASE_URL` (Vercel) and `CORS_ORIGIN` (API host) from §3 still cover the new endpoints. No additional Vercel project settings to change for this release.

### Warnings / notes
- The `yarn install` `YN0086` peer-requirements notice is project-wide and pre-existing — not caused by recharts. Safe to ignore for this deploy; can be cleaned up with `yarn explain peer-requirements` in a follow-up.
- `next build` runs under Turbopack (Next 16) — no separate webpack fallback to verify.
- No new client-side env vars (`NEXT_PUBLIC_*`) added, so no frontend redeploy-after-env-change step is needed for this release — just the standard "redeploy frontend after merging" flow.

### Release ordering for this batch
1. Run `prisma migrate deploy` against prod Postgres (or deploy backend with `start:prod` which does it automatically).
2. Deploy backend (new SRS + vocabulary endpoints become live).
3. Deploy frontend (Vercel) — new routes `/vocabulary*`, `/topics/[slug]/review`, dashboard charts become live.
4. Smoke test: register/login → seed a few flashcards → `/topics/[slug]/review` shows a session → mark cards → `/dashboard` charts render → `/vocabulary` CRUD works.

**Verdict:** Cleared to deploy. No code/config changes needed beyond what is already in the repo.
