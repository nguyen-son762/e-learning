# v8 QA Report — Personal Vocabulary Topics

**Date:** 2026-06-13
**Inspector:** qa-inspector
**Scope:** Boundaries introduced by v8 (`VocabularyTopic`, `vocabularyTopicId` on `VocabularyEntry`, new `/api/vocabulary-topics` family, `?vocabularyTopicId=__none__` filter, `/vocabulary/topics` page).
**Contract:** `_workspace/01_design/api-contract.md` v8 + `data-model.md` v8 + `route-map.md` v8.
**Result:** 9 / 9 PASS. No defects requiring backend or frontend rework.

---

## Verification method
Each boundary read at producer + consumer simultaneously (`server/src/**` ↔ `src/lib/types.ts` + `src/hooks/**` + `src/app/(app)/vocabulary/**`). Backend `npx tsc --noEmit` clean. Frontend `npx tsc --noEmit` clean.

---

## 1. Contract shape — VocabularyTopic + vocabularyTopicId on VocabularyEntry  →  **PASS**

| Field | Contract | Backend serializer | Frontend type |
|---|---|---|---|
| `VocabularyTopic.id` | `string` | `server/src/lib/serializers.ts:176` | `src/lib/types.ts:251` |
| `VocabularyTopic.userId` | `string` | `serializers.ts:177` | `types.ts:252` |
| `VocabularyTopic.name` | `string` | `serializers.ts:178` | `types.ts:253` |
| `VocabularyTopic.color` | `string \| null` | `serializers.ts:179` (`t.color ?? null`) | `types.ts:254` |
| `VocabularyTopic.language` | `"en" \| "zh"` | `serializers.ts:180` (`asLanguage(t.language)`) | `types.ts:255` |
| `VocabularyTopic.createdAt` | ISO 8601 | `serializers.ts:181` (`iso()`) | `types.ts:256` |
| `VocabularyTopic.updatedAt` | ISO 8601 | `serializers.ts:182` (`iso()`) | `types.ts:257` |
| `VocabularyEntry.vocabularyTopicId` | `string \| null` (additive) | `serializers.ts:167` (`v.vocabularyTopicId ?? null`) | `types.ts:175` |

camelCase. Zero divergence.

---

## 2. Endpoint paths + auth + method  →  **PASS**

| Endpoint | Method | Mount | Auth |
|---|---|---|---|
| `/api/vocabulary-topics` | GET | `server/src/app.ts:37` + `vocabularyTopicRoutes.ts:14` | `requireAuth` ✓ |
| `/api/vocabulary-topics` | POST | same + `routes:15` | `requireAuth` ✓ |
| `/api/vocabulary-topics/:id` | PATCH | same + `routes:16` | `requireAuth` ✓ |
| `/api/vocabulary-topics/:id` | DELETE | same + `routes:17` | `requireAuth` ✓ |

Frontend hooks (`src/hooks/useVocabularyTopics.ts:36, 49, 61, 71`) hit the same paths with the same verbs. Wrappers (`{items,total}` / `{item}` / `{id}`) match contract sections lines 1552-1555.

---

## 3. `__none__` sentinel agreement  →  **PASS**

- Contract: `api-contract.md:857, 1574` — exact string `"__none__"` selects untagged.
- Frontend constant: `src/lib/types.ts:224` (`VOCABULARY_TOPIC_NONE = "__none__"`).
- Frontend chip strip: `src/app/(app)/vocabulary/page.tsx:209, 212` uses the constant; passes through `useVocabulary` → `?vocabularyTopicId=__none__`.
- `useVocabulary` query builder: `src/hooks/useVocabulary.ts:26` (`q.set("vocabularyTopicId", …)`).
- Backend recognition: `server/src/controllers/vocabularyController.ts:16` (`UNTAGGED_SENTINEL = "__none__"`) and `:146` (`if (raw === UNTAGGED_SENTINEL) where.vocabularyTopicId = null;`).
- Lenient unknown id → empty result: `:148-149` else-branch sets `where.vocabularyTopicId = <id>` and Prisma returns no rows when id doesn't exist. Matches contract §11 + §1574.

---

## 4. POST/PUT vocab with vocabularyTopicId — cross-user + cross-language guards  →  **PASS**

- Cross-user (foreign topic id): `server/src/controllers/vocabularyController.ts:57-63` → `AppError("VALIDATION_ERROR", …, { field: "vocabularyTopicId" })` → 400.
- Cross-language (own topic, wrong language): `vocabularyController.ts:64-70` → same shape.
- Error envelope: `errorHandler.ts:13-20` propagates `details.field` onto the JSON body — frontend can branch on `err.code === "VALIDATION_ERROR"` + the surfaced `field`.
- On PUT, the entry's stored `existing.language` is the SSOT (`vocabularyController.ts:243`) — body language is never trusted to validate the topic. Matches contract §950.
- POST applies the same check post-`resolveCreateLanguage` (line 199). Matches contract §920.
- Frontend always passes topic id verbatim (`src/components/vocabulary-form.tsx:148`) — no spoofing surface.

---

## 5. DELETE vocabulary-topic → SET NULL on entries  →  **PASS** (triple-defense)

1. Prisma relation: `server/prisma/schema.prisma:201` — `vocabularyTopic VocabularyTopic? @relation(... onDelete: SetNull)`.
2. Migration SQL: `server/prisma/migrations/20260613200000_add_vocabulary_topics/migration.sql:34` — `ON DELETE SET NULL`.
3. Application code: `server/src/controllers/vocabularyTopicController.ts:165-173` — `$transaction([updateMany SET vocabularyTopicId=null WHERE userId AND vocabularyTopicId, delete topic])`. The defensive `userId` filter is correct (the FK + relation already constrain scope, but defense-in-depth matches the contract's "owner-scoped" intent at §1159).

Entries are NEVER deleted, only unlinked. Matches contract §15, §1162, data-model §678.

---

## 6. Existing endpoints still serialize vocabularyTopicId  →  **PASS**

Every code path that responds with a `VocabularyEntry` runs `toVocabularyEntry` (which writes `vocabularyTopicId: v.vocabularyTopicId ?? null` at `serializers.ts:167`):

| Endpoint | Code path |
|---|---|
| `GET /api/vocabulary` (list) | `vocabularyController.ts:160` |
| `GET /api/vocabulary/:id` | `vocabularyController.ts:233` |
| `POST /api/vocabulary` | `vocabularyController.ts:226` |
| `PUT /api/vocabulary/:id` | `vocabularyController.ts:289` |
| `POST /api/vocabulary/mine` | `vocabularyController.ts:423` (wrapped in `{item}`) |

`PUT /:id/favorite` and `PUT /:id/progress` deliberately return minimal `{id, isFavorite}` / `{id, known}` — contract does NOT require the full entry there, so no field expected. Matches contract §1565.

---

## 7. shadcn Select + shadcn Dialog used (not native)  →  **PASS**

- Manage page filter UI on `/vocabulary` uses shadcn `Select` for tag / partOfSpeech / sort (`src/app/(app)/vocabulary/page.tsx:255-303`); the topic filter is a chip strip of shadcn `Button` (intentional per route-map §32) — not a native control.
- `VocabularyForm` topic select: `src/components/vocabulary-form.tsx:347-358` uses shadcn `Select` from `@/components/ui/select`.
- Create / rename dialog: `src/components/vocabulary-topic-dialog.tsx:140-156` — shadcn `Dialog` + `DialogContent/Header/Title/Description/Footer`.
- Delete confirm: `src/app/(app)/vocabulary/topics/page.tsx:314-326` uses project's `ConfirmDialog` (a shadcn-Dialog wrapper). No `window.confirm` / native `<select>` / native `<dialog>` anywhere in the v8 paths.

---

## 8. Route-map matches real Next.js routes  →  **PASS**

`/vocabulary/topics` route exists at `src/app/(app)/vocabulary/topics/page.tsx`. The `(app)` route group strips correctly → public URL `/vocabulary/topics`, matching route-map §33 and the contract's frontend-route enumeration §1257-1260. TopNav link at `src/components/top-nav.tsx:83` (`{ href: "/vocabulary/topics", label: "Chủ đề từ vựng" }`). Navigation push from card click at `vocabulary/topics/page.tsx:186` (`router.push(/vocabulary?vocabularyTopicId=<id>)`) resolves to the existing `/vocabulary` route, which seeds the chip state from the query param at `src/app/(app)/vocabulary/page.tsx:93-96`. Deep-link wiring is closed end-to-end.

---

## 9. Language scope enforced end-to-end  →  **PASS**

- Backend list: `vocabularyTopicController.ts:72` calls `resolveListLanguage(userId, req.query.language)` — same shared helper used since v6. On `user.language === null` + no override → `403 LANGUAGE_NOT_SELECTED`.
- Backend create: `:93` uses `resolveCreateLanguage` (same null-guard). Topic's `language` is **immutable** post-create — PATCH zod schema `vocabularyTopicController.ts:36-49` does NOT permit `language`; even if a stray `language` is sent, `passthrough()` lets it land in `body` but neither code path reads it for the update.
- Frontend list scoping: `/vocabulary/topics` (`page.tsx:52`) and `/vocabulary/new` (`new/page.tsx:21`) call `useVocabularyTopics(user.language)`.
- Frontend list scoping on EDIT: `/vocabulary/[id]/edit/page.tsx:26` calls `useVocabularyTopics(data?.language)` — i.e., the **entry's** stored language, NOT the user's current language. Critical for users who switch languages while editing — the topic list shown matches what the backend will accept, preventing a UX dead-end.
- Backend write check, on the entry side: `vocabularyController.ts:243` derives `language` from `existing.language` (the entry's stored value) before calling `assertOwnedTopicSameLanguage` — cross-language re-tagging is rejected even if the user owns the topic.
- Hook cache key: `useVocabularyTopics.ts:33` uses `vocabulary-topics:${language}` so switching `user.language` reads a different cache slot, never leaking topics from the other language into the chip strip / select.

---

## Additional observations (informational, not defects)

- The `/mine` endpoint correctly rejects `vocabularyTopicId` in the body at `vocabularyController.ts:367-377` (pre-zod hasOwnProperty check); persists `vocabularyTopicId: null` at `:419`. Mirrored on the frontend at `src/components/selection-popover.tsx:130-132` (destructures the field out of the body before posting). Both sides agree even though only one side strictly needs to enforce.
- `TOPIC_NAME_CONFLICT` 409 mapping: `errors.ts:11, 22` + `vocabularyTopicController.ts:108-115` (POST) and `:140-152` (PATCH). Frontend handles at `vocabulary-topic-dialog.tsx:120-124` — surfaces a Vietnamese message and keeps the dialog open with typed name preserved. Strong UX boundary.
- The `/vocabulary` (list) page does not pass `?language=…` to `useVocabulary` (line 110 — `useVocabulary(params)` with no language). Backend defaults to `user.language` via `resolveListLanguage`, so behavior is correct. This matches the pre-v8 pattern and is NOT a regression.
- Migration is committed but not yet applied to Supabase per backend's note. Deploy step owns `prisma migrate deploy`. No frontend or backend code-level action required for this report.

---

## Verdict
All 9 contract boundaries pass with concrete `file:line` evidence on both producer and consumer sides. No FAIL, no UNVERIFIED. v8 is integration-coherent and ready to ship pending production migration apply.
