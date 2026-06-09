---
name: nextjs-frontend
description: "Builds the e-learning frontend in Next.js App Router with Tailwind + shadcn/ui, typing data hooks strictly to the API contract. Use when implementing Next.js pages/components/hooks, wiring the UI to the backend, or fixing frontend/routing/data-fetching issues for the e-learning app."
---

# Next.js Frontend — App Router + Tailwind + shadcn/ui

Build the UI exactly as `design-spec.md` describes and consume exactly what `api-contract.md` promises. The contract is law; deviating from it is the #1 cause of runtime crashes.

## Project Structure
```
src/
  app/                 # App Router: pages, layouts, route groups (group), [param]
  components/          # shadcn/ui-based reusable components
  hooks/               # typed data hooks (one per endpoint area)
  lib/                 # fetchJson, auth client, utils
```
Server Components by default; add `"use client"` only for interactivity/state.

## Data Hooks — Match Types to the Contract
The hook's generic type must equal the contract's response shape **including the wrapper**. If the contract returns `{ items, total }`, type it that way and unwrap `.items` — never type it as a bare array.
```ts
// contract: GET /api/courses → { items: Course[], total: number, page: number }
type CoursesResponse = { items: Course[]; total: number; page: number };
export function useCourses(params: CoursesParams) {
  return useQuery(['courses', params], () =>
    fetchJson<CoursesResponse>(`/api/courses?${qs(params)}`)); // returns the WRAPPER
}
// consumers read data.items — not data.filter(...)
```
**Why this matters:** `fetchJson<Course[]>` on a `{ items: [...] }` response compiles fine and then throws `data.filter is not a function` at runtime. The type must match what the server actually sends.

## Routing — Links Must Point at Real Routes
Every `href`, `router.push()`, `redirect()` must resolve to a real file under `src/app/`. Compute the URL from the file path:
- `app/(app)/dashboard/courses/page.tsx` → `/dashboard/courses` (group `(app)` stripped).
- `app/courses/[slug]/page.tsx` → `/courses/${slug}`.
A link to `/courses` when the page lives at `/dashboard/courses` is a 404 — check the route map, not your memory.

## Component Library — Prefer shadcn/ui (rule)
If shadcn/ui provides a component, **use it instead of a native HTML element or a hand-rolled one** — `Button` (not `<button>`), `Select` (not `<select>`), `Textarea` (not `<textarea>`), `Input`, `Label`, `Dialog`, `Checkbox`, `Switch`, `Tabs`, etc. This keeps styling, tokens, focus rings, and a11y consistent across the app.
- If the needed shadcn component isn't installed yet, add it (`npx shadcn@latest add <name>`, or hand-add the file under `src/components/ui/` following the existing ones + install its Radix dep) **before** reaching for a native element.
- **Justified exceptions** (document inline with a short comment): a large clickable *content surface* that isn't a control — e.g. the flashcard flip area — may stay a native `<button>`/`<div role="button">` because wrapping it in `Button` fights the layout. Native elements are a last resort, not a default.

## State Handling
Every data-driven screen handles loading, empty, error, and unauthenticated states. Use shadcn/ui (`Skeleton`, `Alert`, etc.) and Tailwind tokens from the design spec — no hardcoded hex when a token exists.

## camelCase
All field access is camelCase to match the contract. Never read `thumbnail_url`; the contract guarantees `thumbnailUrl`.

## If You Think the Contract Is Wrong
Don't silently adapt to a guessed shape. Message backend-engineer + design-architect, and stub against the contract (`// TODO: wire to live API`) so you stay unblocked and QA knows it's a stub, not a defect.

## After Completion
Write `_workspace/02_frontend/summary.md`: pages built, hooks built (with the exact type each consumes), endpoints consumed. Report the module done so QA can run its incremental boundary check.
