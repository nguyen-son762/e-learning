---
name: express-backend
description: "Builds the e-learning backend as an Express + Postgres + Prisma API, returning responses that exactly match the API contract. Use when implementing Express routes/controllers, the Prisma schema/migrations, auth/validation, or fixing backend/API/database issues for the e-learning app."
---

# Express Backend — Express + Postgres + Prisma

Implement exactly the endpoints `api-contract.md` declares, returning exactly the shapes (and wrappers, and casing) it promises. The frontend is typed to the contract — any deviation crashes it at runtime.

## Project Structure
```
src/
  routes/          # express routers, one per resource
  controllers/     # request handling + response mapping
  middleware/      # auth, validation, error handler
  lib/             # prisma client, helpers
prisma/
  schema.prisma    # models
  migrations/      # generated migrations
```

## Responses Must Match the Contract Exactly
The hard rule that prevents most boundary bugs: **map DB rows to the contract's shape in the response layer.**
- **Wrapper:** contract says `{ items, total, page }` → return exactly that. Not a bare array, not `{ data: [...] }`.
- **Casing:** Postgres/Prisma columns are often snake_case; the contract is camelCase. Map them. Never let `thumbnail_url` leak when the contract says `thumbnailUrl`.
```ts
// GET /api/courses → { items, total, page } per contract
const rows = await prisma.course.findMany({ skip, take, where });
const total = await prisma.course.count({ where });
res.json({
  items: rows.map(r => ({
    id: r.id, title: r.title, slug: r.slug,
    thumbnailUrl: r.thumbnailUrl,        // camelCase out, always
    instructorName: r.instructor.name,
    lessonCount: r._count.lessons,
    enrolled: enrolledIds.has(r.id),
  })),
  total, page,
});
```

## Prisma Schema
Model the e-learning domain from `data-model.md`: User(role), Course, Module, Lesson, Enrollment(status), Progress, Quiz, QuizAttempt(status). Use enums for status fields. Generate migrations (`prisma migrate dev`); keep them additive on revisions.

## State Machine Completeness
If `data-model.md` defines a lifecycle (e.g. enrollment `pending → active → completed`, quiz attempt `started → submitted → graded`), implement **every** declared transition. A missing intermediate→final transition leaves the frontend polling forever — exactly the "stuck generating" class of bug. Don't define transitions you never execute, either.

## Auth & Validation
- Auth per contract (JWT or session). Role-based checks for instructor-only actions; never trust the client for authorization.
- Validate request bodies/params at the boundary (zod or similar). Return the contract's error codes: `401`, `403`, `404`, `422`.

## Async Work
Long-running work (bulk enrollment, async grading): return the contract's immediate response (e.g. `202 { status }`) and expose the eventual result via the endpoint the contract specifies. Never put async-only fields in the immediate response — the frontend will crash reading them.

## If the Contract Is Infeasible
If a contract shape can't be implemented faithfully, propose an amendment to design-architect — don't ship a divergent shape.

## After Completion
Write `_workspace/02_backend/summary.md`: each endpoint with its **exact** response shape, models, migrations. Send "endpoint ready: METHOD /path → shape" to frontend-engineer and report the module done for QA's incremental check.
