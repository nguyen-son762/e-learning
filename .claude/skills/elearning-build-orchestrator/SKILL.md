---
name: elearning-build-orchestrator
description: "Orchestrates the e-learning web app build team (design → frontend → backend → QA → deploy) as a coordinated agent team. Use for building or extending the e-learning app from wireframe to deployment, implementing screens/APIs/features, or running the full-stack pipeline. Follow-up work — rebuild, re-run, update, fix, revise, partial rebuild, improve previous result, add a screen/endpoint/feature, redeploy — also uses this skill."
---

# E-Learning Build Orchestrator

Coordinates a five-member agent team to take the e-learning web app from wireframe to deployment. Frontend (Next.js) and backend (Express/Prisma) build in parallel against a shared **API contract**; QA verifies boundaries incrementally; DevOps ships to Vercel.

## Execution Mode: Agent Team

Frontend and backend must negotiate the API contract live, and QA gives real-time boundary feedback to both — this is exactly where an agent team beats isolated sub-agents. Pattern: **pipeline (design → build → QA → deploy) with a fan-out (frontend ∥ backend) and a producer-reviewer loop (build ↔ QA)**.

## Agent Composition

| Teammate | Agent Type | Role | Skill | Output |
|------|-------------|------|------|------|
| design-architect | design-architect (custom) | wireframe → spec + API contract | design-spec | `_workspace/01_design/` |
| frontend-engineer | frontend-engineer (custom) | Next.js UI vs contract | nextjs-frontend | `src/app/`, `src/hooks/`, `_workspace/02_frontend/` |
| backend-engineer | backend-engineer (custom) | Express+Prisma API vs contract | express-backend | `src/routes/`, `prisma/`, `_workspace/02_backend/` |
| qa-inspector | qa-inspector (custom, general-purpose tooling) | boundary coherence QA | integration-qa | `_workspace/03_qa/` |
| devops-deployer | devops-deployer (custom) | Vercel deploy + CI | vercel-deploy | `vercel.json`, `.github/`, `_workspace/04_deploy/` |

All agents are spawned with `model: "opus"`.

## Workflow

### Phase 0: Context Check (follow-up support)
1. Check whether `_workspace/` exists.
2. Decide run mode:
   - **No `_workspace/`** → initial build. Go to Phase 1.
   - **`_workspace/` exists + partial change requested** (e.g. "add a quiz screen", "fix the enrollment endpoint") → **partial rebuild**. Re-spawn only the affected agents; pass them the existing artifact paths and the specific change. Skip unaffected phases.
   - **`_workspace/` exists + new/changed requirements** → **fresh build**. Move existing `_workspace/` to `_workspace_{YYYYMMDD_HHMMSS}/`, then Phase 1.
3. For a partial rebuild, route by change type:
   - Screen/UI only → frontend-engineer (+ qa-inspector).
   - Endpoint/data only → backend-engineer (+ qa-inspector). If the response shape changes, design-architect updates the contract first, then **both** build agents re-sync.
   - New feature spanning UI+API → design-architect updates contract → frontend + backend → QA → deploy.
   - Deploy/config only → devops-deployer.

### Phase 1: Preparation
1. Analyze the user's input — wireframes, feature list, or change request. Detect the user's technical level from their wording and adjust how much you explain.
2. Create `_workspace/` (or move the old one aside on a fresh build) with subdirs `00_input/ 01_design/ 02_frontend/ 02_backend/ 03_qa/ 04_deploy/`.
3. Save the input (wireframes/brief) to `_workspace/00_input/`.
4. Confirm the stack defaults with the user only if they differ from the harness baseline: **Next.js App Router + Tailwind + shadcn/ui; Express + Postgres + Prisma; Vercel deploy.**

### Phase 2: Team Setup
1. `TeamCreate(team_name: "elearning-build", members: [...])` — spawn all five agents with `model: "opus"`, each given its role prompt and the workspace paths.
2. `TaskCreate` the pipeline with dependencies:
   - `design`: produce spec + contract (assignee: design-architect)
   - `frontend`: build screens vs contract (assignee: frontend-engineer, depends_on: design)
   - `backend`: build API vs contract (assignee: backend-engineer, depends_on: design)
   - `qa-frontend`, `qa-backend`, `qa-integration`: boundary checks (assignee: qa-inspector, depend on the matching build task — but QA claims each **as soon as a module reports done**, not at the very end)
   - `deploy`: Vercel + CI (assignee: devops-deployer, depends_on: qa-integration PASS)

### Phase 3: Build (self-coordinated)
**Execution:** teammates self-coordinate.

Flow and communication rules:
- design-architect produces `_workspace/01_design/` first, then **broadcasts the contract** to frontend + backend.
- frontend-engineer and backend-engineer build **in parallel** against the contract. backend sends "endpoint ready: METHOD /path → shape" to frontend as each lands; frontend pings backend when it starts consuming an endpoint.
- **Incremental QA:** the moment a build agent reports a module done, qa-inspector claims a QA task and does "both-sides-together" boundary checks. On a mismatch, QA messages **both** producer and consumer with `file:line` + fix.
- Leader monitors via `TaskGet`; intervenes (SendMessage / reassign) if an agent stalls or a contract dispute deadlocks (leader breaks ties by having design-architect amend the contract authoritatively).

**Artifact storage:** each agent writes per its protocol; real code goes in the project tree, summaries/reports in `_workspace/`.

### Phase 4: Integration QA & Gate
1. Wait for `frontend` + `backend` tasks complete (`TaskGet`).
2. qa-inspector runs a full integration pass → `_workspace/03_qa/qa-report.md` (PASS/FAIL/UNVERIFIED per boundary).
3. If FAIL findings exist → route fixes back to the owning agents (one retry loop), then re-QA the affected boundaries. Cap at 2 fix rounds; remaining FAILs are documented, not hidden.
4. Gate: deploy proceeds only when integration coherence is PASS.

### Phase 5: Deployment
1. devops-deployer verifies prod build, configures env + Vercel + CI, runs migrations, deploys (or produces READY-TO-RUN steps if credentials aren't available in-session).
2. Output `_workspace/04_deploy/deploy-report.md`.

### Phase 6: Cleanup & Evolution
1. Ask the team to wrap up; `TeamDelete`.
2. Preserve `_workspace/` (audit trail).
3. Summarize for the user: what was built, QA status (PASS/FAIL/UNVERIFIED counts), deploy URL or steps.
4. **Offer the evolution hook:** ask if anything should change in the result, the team, or the workflow — and record any harness change in CLAUDE.md's change log.

## Data Flow
```
[leader] → TeamCreate → design-architect → _workspace/01_design/{api-contract,route-map,data-model,design-spec}.md
                              │ broadcast contract
                ┌─────────────┴─────────────┐
        frontend-engineer  ←SendMessage→  backend-engineer
          src/app, src/hooks               src/routes, prisma
                └──────── module ready ────────┘
                              ↓ (incremental)
                        qa-inspector → _workspace/03_qa/qa-report.md
                              ↓ PASS
                        devops-deployer → vercel.json, CI → _workspace/04_deploy/
```

## Error Handling
| Situation | Strategy |
|------|------|
| One teammate fails/stops | leader detects idle → SendMessage to check → restart or reassign |
| Majority of teammates fail | notify user, confirm whether to continue |
| Timeout | use partial results; note unfinished modules in the report |
| Contract dispute (front vs back) | design-architect amends contract authoritatively; both re-sync |
| Unresolved QA FAIL (after 2 rounds) | document in qa-report, block deploy on integration coherence, surface to user |
| Build failure at deploy | devops blocks deploy, returns failing output to owning engineer |
| Data conflict | keep both with sources; contract is the reference |

## Team Size
5 members (medium-large build). Keep each agent's task list to ~4–6 items. QA is incremental, not a single end task.

## Test Scenarios

### Normal Flow
1. User provides wireframes for a course catalog + lesson player + enrollment.
2. Phase 1: workspace created, input saved.
3. Phase 2: team of 5 spawned, pipeline tasks created with dependencies.
4. Phase 3: design-architect publishes contract; frontend + backend build in parallel; QA checks each module as it lands.
5. Phase 4: full integration QA → PASS.
6. Phase 5: Vercel config + CI produced, build verified, deploy (or READY-TO-RUN).
7. Expected: working app code + `_workspace/04_deploy/deploy-report.md`.

### Error Flow
1. Phase 3: frontend hook types `Course[]` but backend returns `{ items: Course[] }`.
2. qa-inspector catches it on the incremental pass, messages **both** with `file:line`.
3. design-architect confirms contract says `{ items, total }`; frontend fixes the unwrap.
4. Re-QA the boundary → PASS; pipeline continues to deploy.
5. qa-report records the caught mismatch and its resolution.
