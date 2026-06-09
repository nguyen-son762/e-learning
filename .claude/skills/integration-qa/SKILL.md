---
name: integration-qa
description: "Verifies integration coherence for the e-learning app — API response shapes vs frontend hook types, links vs real routes, state transitions vs code, contract vs implementation — incrementally as modules land. Use for QA, testing, verification, integration checks, or hunting boundary/runtime bugs in the full-stack app."
---

# Integration QA — boundary coherence verification

Verify that the two sides of every boundary **agree**. Existence is not the bar — agreement is. Run this **per module as it lands**, not once at the end, so mismatches don't propagate.

## Core Principle: Read Both Sides Together
A boundary bug is invisible from one side. Open producer and consumer together and compare the actual values:

| Boundary | Producer (left) | Consumer (right) | Common bug |
|--------|-------------|---------------|----------|
| Response shape | controller `res.json()` | hook `fetchJson<T>` | wrapper mismatch → `x.filter is not a function` |
| Field casing | Prisma→response mapping | frontend type | `thumbnail_url` vs `thumbnailUrl` → undefined |
| Routing | `src/app/` file path | `href`/`router.push` | wrong prefix → 404 |
| State transition | data-model state machine | backend `status:` updates | missing transition → stuck forever |
| Endpoint coverage | contract endpoint list | hooks that call them | API exists, no hook → feature dead |
| Sync/async | immediate `202` response | frontend field access | reading async-only field on sync response → crash |

## Why a Passing Build Is Not Enough
`npm run build` passing is necessary, not sufficient. `fetchJson<Course[]>` against a `{ items: [...] }` response **compiles** and crashes at runtime; `as` casts and generics hide the mismatch from the type checker. You exist to catch exactly what the compiler can't. Verify against the **contract** and the **real runtime shape**, not the type annotation.

## Procedure
1. Read `_workspace/01_design/{api-contract,data-model,route-map}.md` as the reference.
2. For each completed module, run the matching cross-boundary checks (see `references/qa-checklist.md` for the full grep-driven procedure).
3. Run `npm run build`/typecheck — record as one signal among several, not the verdict.
4. Write findings to `_workspace/03_qa/qa-report.md` as **PASS / FAIL / UNVERIFIED**, each with `file:line` on **both** sides and a concrete fix.
5. On a FAIL, message **both** producer and consumer (either may own the fix; they must agree). Re-verify after the fix.

## Incremental Execution
Claim a QA task the instant a build agent reports a module done. Early boundary mismatches propagate into every later module and multiply fix cost — incremental QA is the whole point.

## Report Format
```
## GET /api/courses ↔ useCourses
FAIL — wrapper mismatch
  producer: src/controllers/courses.ts:42 returns { items, total }
  consumer: src/hooks/useCourses.ts:11 typed fetchJson<Course[]> (expects bare array)
  fix: type as { items: Course[]; total: number } and read data.items
  notified: frontend-engineer, backend-engineer
```

The full grep-driven checklist (response shapes, routing, state machines, orphan endpoints) is in `references/qa-checklist.md` — load it when running a pass.
