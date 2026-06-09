# Integration QA — full cross-boundary checklist

Grep-driven procedure for each boundary. Run the matching section as each module lands. Always read **both** sides before judging.

## Table of Contents
1. API Response Shape ↔ Frontend Hook Type
2. Routing Coherence
3. State Machine Coherence
4. Endpoint ↔ Hook 1:1 Mapping
5. Data Flow (casing / null)
6. Build & Type Signals

---

## 1. API Response Shape ↔ Frontend Hook Type
1. Grep backend response sites: `res.json(`, `res.status(...).json(` in `src/controllers/` and `src/routes/`.
2. For each, extract the object shape actually returned (keys + wrapper).
3. Grep the matching hook: `fetchJson<` / `useQuery` in `src/hooks/`, extract the generic `T`.
4. Compare: keys, wrapper (`{ items, total }` vs bare array), and casing must all match the contract.
5. FAIL patterns: bare-array type on a wrapped response; `{ data: [...] }` on the server but hook reads top-level; pagination object vs array.

## 2. Routing Coherence
1. List page files: every `page.tsx` under `src/app/`. Derive each URL — strip route groups `(group)`, keep `[param]` as dynamic.
2. Grep link sites: `href=`, `router.push(`, `redirect(`, `<Link href=`.
3. For each link, confirm a real page produces that URL. Watch for missing path prefixes (e.g. `/courses` vs `/dashboard/courses`) and dynamic segments filled with the right param.
4. FAIL: link to a URL no file produces → 404.

## 3. State Machine Coherence
1. From `data-model.md`, list every declared transition for each state machine (e.g. enrollment, quiz attempt).
2. Grep backend status writes: `status:` in `.update(`/`.create(` calls.
3. Every declared transition must appear in code (no missing transition — esp. intermediate→final). Every code transition must be declared (no unauthorized transition).
4. Grep frontend branches: `status ===` / `switch (status)`. Every branch value must be a state actually reachable in the backend.
5. FAIL: declared-but-never-executed (dead) transition; executed-but-undeclared transition; frontend branches on an unreachable status.

## 4. Endpoint ↔ Hook 1:1 Mapping
1. From the contract (and `src/routes/`), list every endpoint (method + path).
2. From `src/hooks/`, list every fetch target.
3. Endpoint with no hook → flag "uncalled" — is it intentional (admin/internal) or a missing wire?
4. Hook targeting a non-existent endpoint → FAIL.

## 5. Data Flow (casing / null)
1. Compare Prisma column names → response mapping → frontend type field names. Casing must converge to camelCase at the API boundary.
2. Optional fields: confirm null/undefined handled on both sides (backend may omit; frontend must not assume presence).
3. FAIL: snake_case leaking into JSON; frontend reading a field the API never sends (→ undefined).

## 6. Build & Type Signals
1. Run `npm run build` (frontend) and the API build. Record pass/fail.
2. Treat a pass as necessary, not sufficient — grep for `as ` casts and broad generics around fetch calls; these hide runtime mismatches the checks above catch.

---

## Reporting
For every check: **PASS / FAIL / UNVERIFIED**, with `file:line` on both sides and a concrete fix. UNVERIFIED (one side missing) is never silently upgraded to PASS. On FAIL, notify both producer and consumer.
