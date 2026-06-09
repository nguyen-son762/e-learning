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
