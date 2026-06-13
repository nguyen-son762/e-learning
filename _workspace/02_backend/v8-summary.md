# Backend v8 — Personal Vocabulary Topics

Implements the v8 API contract additions (`/api/vocabulary-topics` CRUD + `?vocabularyTopicId=` filter on `/api/vocabulary` + entry write-path tagging).

## Files touched

- `server/prisma/schema.prisma` — new `VocabularyTopic` model + `vocabularyTopicId` FK + new index on `VocabularyEntry`; `User.vocabularyTopics` back-relation. **Topic / Flashcard / VocabularyEntry.tags[] untouched.**
- `server/prisma/migrations/20260613200000_add_vocabulary_topics/migration.sql` — forward-only: `CREATE TABLE vocabulary_topics`, `ALTER TABLE vocabulary_entries ADD COLUMN vocabulary_topic_id` (nullable, `ON DELETE SET NULL`), the two indexes. Pre-v8 rows backfill to `NULL` (no data movement needed).
- `server/src/lib/errors.ts` — new `TOPIC_NAME_CONFLICT` error code (409); `AppError` gains optional `details: { field? }` so 400 validation errors can surface `field: "vocabularyTopicId"`.
- `server/src/middleware/errorHandler.ts` — emits `field` on the error payload when present.
- `server/src/lib/serializers.ts` — `toVocabularyEntry` now emits `vocabularyTopicId` on every entry response; new `toVocabularyTopic` serializer.
- `server/src/controllers/vocabularyTopicController.ts` — list / create / patch / delete.
- `server/src/routes/vocabularyTopicRoutes.ts` — owner-scoped routes.
- `server/src/app.ts` — mounts `/api/vocabulary-topics`.
- `server/src/controllers/vocabularyController.ts` — list filter, create/update FK acceptance + validation, mine rejection + null.

## Endpoints implemented (exact wire shapes)

All require `Bearer` auth.

| Method | Path | Success shape |
|--------|------|---------------|
| GET    | `/api/vocabulary-topics?language=en\|zh` | `200 { items: VocabularyTopic[], total: number }` |
| POST   | `/api/vocabulary-topics` body `{ name, color?, language? }` | `201 { item: VocabularyTopic }` |
| PATCH  | `/api/vocabulary-topics/:id` body `{ name?, color? }` | `200 { item: VocabularyTopic }` |
| DELETE | `/api/vocabulary-topics/:id` | `200 { id: string }` |

`VocabularyTopic = { id, userId, name, color: string|null, language: "en"|"zh", createdAt, updatedAt }`. List is sorted `name ASC` case-insensitive in JS for deterministic ordering across DB collations.

## Extensions to existing /api/vocabulary endpoints

- **`GET /api/vocabulary`** accepts `?vocabularyTopicId=<id|__none__>`. `__none__` → `vocabularyTopicId IS NULL`. Empty string / absent → no filter. Unknown id → empty result (no error — matches `?tag` leniency).
- **`POST /api/vocabulary`** accepts `vocabularyTopicId?: string | null` in body. Non-null → ownership + same-language validated → else `400 VALIDATION_ERROR { field: "vocabularyTopicId" }`. Null / omitted → entry stored untagged.
- **`PUT /api/vocabulary/:id`** patch semantics for `vocabularyTopicId`: absent → untouched; explicit `null` → clear; non-null → retag with ownership + same-language check (entry's stored language is SSOT).
- **`POST /api/vocabulary/mine`** rejects any `vocabularyTopicId` in the body with `400 VALIDATION_ERROR { field: "vocabularyTopicId" }`. Mined entries are persisted with `vocabularyTopicId = null` explicitly.
- **All response shapes** for VocabularyEntry (list, detail, create, update, favorite tile reused, progress tile reused, mine) now include `vocabularyTopicId`. The `/favorite` and `/progress` endpoints continue to return their narrow `{ id, isFavorite }` / `{ id, known }` payloads — they were not in the entry-shape contract before and remain unchanged.

## Validation rules enforced

- `name`: trimmed, length 1–60, non-empty after trim.
- `color`: optional, must match `^#[0-9A-Fa-f]{6}$` when provided; `null` allowed (clears).
- `language` on POST: resolved via `resolveCreateLanguage` (body wins, else `user.language`, else `403 LANGUAGE_NOT_SELECTED`).
- `language` on GET list: resolved via `resolveListLanguage` (same 403 rule).
- `language` on PATCH: silently ignored (immutable per contract).
- `(userId, language, name)` uniqueness: DB-enforced; P2002 → `409 TOPIC_NAME_CONFLICT` with VN message naming the duplicate name + language.
- Non-owner topic access → `404 NOT_FOUND` (existence not leaked, matches v2 vocab-entry rule).
- Cross-field topic validation on entry writes: API layer compares `topic.userId === userId` AND `topic.language === entry.language`. PUT uses entry's stored language as SSOT (never client-supplied).

## Migration & delete cascade

- Migration filename: **`20260613200000_add_vocabulary_topics`** (not yet applied to Supabase — deploy step will run `prisma migrate deploy`).
- `DELETE /api/vocabulary-topics/:id` runs in one `prisma.$transaction`:
  1. `UPDATE vocabulary_entries SET vocabulary_topic_id = NULL WHERE user_id = $caller AND vocabulary_topic_id = $id;`
  2. `DELETE FROM vocabulary_topics WHERE id = $id;` (owner-only loader runs before tx).
- Entries are **NEVER** deleted by a topic delete; only the tag link is cleared.
- The Prisma relation also declares `onDelete: SetNull` as a safety net; the explicit `updateMany` matches the contract's stated SQL plan and the `(userId, vocabularyTopicId)` index makes the scan indexed.

## What is NOT touched

- `Topic` (v4 flashcard bucket), `Flashcard`, `FlashcardProgress`, mined-topic logic — orthogonal.
- `VocabularyEntry.tags[]` — independent free-text labels, still AND-combined with the new topic filter on GET.
- v6 language gating, v7 SRS / streak / XP / badges — no semantic changes.

## Verification

- `npx prisma generate` — clean.
- `npx tsc --noEmit` (server) — clean.
- `npx prisma migrate status` — sees the new pending migration; no DB drift reported.
- Migration NOT applied to Supabase from this agent; deploy step owns that.
