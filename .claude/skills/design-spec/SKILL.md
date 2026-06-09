---
name: design-spec
description: "Turns e-learning wireframes/requirements into a markdown design spec, design system tokens, page+route map, data model, and the shared API contract. Use when producing design specs, defining screens/components, mapping routes, or drafting the API contract for the e-learning app — and when revising any of these."
---

# Design Spec — wireframe → buildable spec & API contract

Produce four artifacts in `_workspace/01_design/`. The API contract is the most important: it's the single thing frontend and backend both build against, so most integration bugs are prevented or caused here.

## Why the Contract Comes First
Frontend types its hooks to the contract; backend shapes its responses to the contract. If the contract is vague about field casing or list wrappers, both sides guess — and guesses diverge into runtime crashes. A precise contract is the cheapest bug prevention in the pipeline.

## Artifacts

### 1. `design-spec.md`
Per screen: purpose, layout (ASCII/structured), component list (mapped to shadcn/ui primitives), states (loading/empty/error/auth), responsive behavior. Plus a design-tokens section: color, typography scale, spacing, radius. E-learning lens: catalog, course detail, lesson player, progress, quiz, dashboard, instructor views.

### 2. `route-map.md`
A table — every route, ordered by user flow:

| URL | `src/app/` path | purpose | data needs | endpoints consumed |
|-----|-----------------|---------|-----------|--------------------|
| `/courses` | `app/courses/page.tsx` | catalog | course list | `GET /api/courses` |
| `/courses/[slug]` | `app/courses/[slug]/page.tsx` | detail | one course + lessons | `GET /api/courses/:slug` |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | my courses | enrollments | `GET /api/enrollments/me` |

Account for route groups `(group)` (stripped from URL) and dynamic `[param]` segments — note the real URL each file produces.

### 3. `data-model.md`
Entities, fields (with types), relationships, and any state machines. For e-learning, define at least: User(role), Course, Module, Lesson, Enrollment(status), Progress, Quiz, QuizAttempt(status). For each state machine, list **every** allowed transition — backend must implement them all and QA checks for missing/dead transitions.

### 4. `api-contract.md` — the contract
Open with: **"All JSON fields are camelCase. List endpoints return `{ items, total, page }` unless noted."** Then, per endpoint:
```
### GET /api/courses
Consumed by: /courses
Request: query ?page ?pageSize ?category
Response 200: { items: Course[], total: number, page: number }
  Course: { id: string, title: string, slug: string, thumbnailUrl: string,
            instructorName: string, lessonCount: number, enrolled: boolean }
Errors: 401
```
Contract rules to enforce:
- **camelCase** for every JSON field — state it, repeat it where DB columns are snake_case.
- Declare the **wrapper** on every list endpoint (`{ items, total }`), never a bare array unless explicitly noted.
- For async work, declare the **immediate** response (e.g. `202 { status }`) separately from the **eventual** result and which endpoint returns it.
- No orphans: every endpoint names its consuming screen; every screen in the route map names its endpoints.

## Work Order
1. Read input from `_workspace/00_input/`.
2. Draft data-model → route-map → api-contract → design-spec (model first, so endpoints have entities to return).
3. Cross-check: every route's `endpoints consumed` exists in the contract; every contract endpoint has a consumer.
4. Broadcast the contract to frontend + backend (team mode).

## Generalization / Assumptions
When a wireframe is silent, make a reasonable e-learning-domain choice and mark it `ASSUMPTION:` inline so QA and the user can review it — don't block, but don't hide the guess.

## On Revision
On a partial revision, change only the affected entries and state the diff explicitly so downstream agents re-sync only what changed.
