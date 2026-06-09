---
name: vercel-deploy
description: "Prepares and runs the e-learning app deployment to Vercel — prod build verification, env config, vercel.json, CI workflow, Prisma production migrations, and frontend↔API wiring. Use for deploy, Vercel setup, CI pipeline, env vars, production build, or redeploy of the e-learning app."
---

# Vercel Deploy — release readiness for Next.js + Express API

Ship the QA-passed app: Next.js frontend on Vercel, Express + Prisma API as a companion (Vercel serverless functions or a connected Node host) with managed Postgres. Deploy nothing that isn't green.

## Entry Condition
`_workspace/03_qa/qa-report.md` must be PASS on integration coherence. If not, block and tell the leader.

## 1. Build Verification
- Frontend: `next build` succeeds with no type errors.
- API: clean install + build/start succeeds.
- Treat any failure as a blocker — return the failing output to the owning engineer, do not force the deploy.

## 2. Environment Variables (treat them like a contract)
Enumerate every required var in `.env.example` (no real values):
```
DATABASE_URL=
JWT_SECRET=
NEXT_PUBLIC_API_BASE_URL=      # MUST point at the deployed API in prod, not localhost
```
The classic prod-only break: the deployed frontend still points `NEXT_PUBLIC_API_BASE_URL` at `localhost`. Verify this wiring explicitly. Real values live only in Vercel/CI secret stores, never in the repo.

## 3. Vercel Configuration
Produce `vercel.json` (build/output settings, serverless function config for the API routes if co-deployed) and document Vercel project settings (env vars, build command, root directory if monorepo). Wire the frontend's API base URL to the deployed API URL.

## 4. CI (`.github/workflows/ci.yml`)
Pipeline on every push: install → typecheck → `next build` (+ API build) → optional tests. Gate deploys on green CI.

## 5. DB Migration
Run `prisma migrate deploy` against the production database as part of release — before/with the deploy, never after the app is live on an old schema.

## When Credentials Are Unavailable
If Vercel/DB credentials aren't available in-session, don't guess secrets. Produce the complete config files + the exact commands and a precise checklist, and mark the deploy `READY-TO-RUN` in the report.

## Output
`_workspace/04_deploy/deploy-report.md`: build results, env var checklist (✓/✗), deploy URL **or** the READY-TO-RUN steps, migration status. List any blockers and who owns them.
