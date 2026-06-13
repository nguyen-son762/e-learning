# Frontend v8 — Personal Vocabulary Topics

Built against api-contract.md v8. `npx tsc --noEmit` passes. `npm run build` succeeds — `/vocabulary/topics` route generated. Lint introduced no new errors.

## Types — src/lib/types.ts
- `VocabularyEntry.vocabularyTopicId: string | null` added (mirrors contract line 189).
- `VocabularyInput.vocabularyTopicId?: string | null` added — `null` clears the tag on PUT; equivalent to omission on POST.
- `VocabularyListParams.vocabularyTopicId?: string` added.
- Exported sentinel `VOCABULARY_TOPIC_NONE = "__none__"`.
- New shapes: `VocabularyTopic`, `VocabularyTopicCreateInput`, `VocabularyTopicPatchInput`, `VocabularyTopicItemResponse` (POST/PATCH wrap), `VocabularyTopicDeleteResponse` ({id}).

## Hooks — new file src/hooks/useVocabularyTopics.ts
- `useVocabularyTopics(language)` — `GET /api/vocabulary-topics?language=<L>` returning the `{items, total}` wrapper. Cache key `vocabulary-topics:<language>` so a language switch invalidates cleanly.
- `createVocabularyTopic(input)` — `POST /api/vocabulary-topics`, unwraps `{item}` → `VocabularyTopic`.
- `updateVocabularyTopic(id, patch)` — `PATCH /api/vocabulary-topics/:id`, unwraps `{item}`.
- `deleteVocabularyTopic(id)` — `DELETE /api/vocabulary-topics/:id`, returns `{id}`.

## Hooks — edited src/hooks/useVocabulary.ts
- `buildVocabularyQuery` threads `vocabularyTopicId` into the query string.

## Components
- New `src/components/vocabulary-topic-dialog.tsx` — shared shadcn `Dialog` for create + rename, with an 8-color preset palette (`TOPIC_COLOR_PALETTE`). On `409 TOPIC_NAME_CONFLICT` it shows the Vietnamese toast `"Bạn đã có chủ đề tên \"<name>\" trong <Tiếng Anh|Tiếng Trung>."` and keeps the dialog open with the typed name preserved.
- Edited `src/components/vocabulary-form.tsx` — accepts optional `topics: VocabularyTopic[]` + `onTopicCreated` callback. Renders a shadcn `Select` "Chủ đề từ vựng" with color-dot items, plus an inline "+ Tạo chủ đề mới" link button that opens `VocabularyTopicDialog`. `toInput()` always emits `vocabularyTopicId: null` for the untagged case so PUT clears the tag.
- Edited `src/components/selection-popover.tsx` — handleSave strips `vocabularyTopicId` before calling `mineVocabulary` (the contract forbids the field on `/mine`).
- Edited `src/components/top-nav.tsx` — added "Chủ đề từ vựng" link to `/vocabulary/topics`. Tightened `isActive` so `/vocabulary` no longer also lights up when on `/vocabulary/topics`.

## Pages
- New `src/app/(app)/vocabulary/topics/page.tsx` — manage page (language-scoped to `user.language`). Card grid; click card → `/vocabulary?vocabularyTopicId=<id>`. Per-card actions: color picker (Popover with `TOPIC_COLOR_PALETTE`), rename (opens `VocabularyTopicDialog`), delete (uses project `ConfirmDialog` with the contract-mandated wording `"N từ vựng sẽ bị bỏ gắn (không bị xoá). Tiếp tục?"`). Per-topic counts computed CLIENT-SIDE by bucketing a single `GET /api/vocabulary?language=<L>` call.
- Edited `src/app/(app)/vocabulary/page.tsx`:
  - Added "Quản lý chủ đề" outline button in the header → `/vocabulary/topics`.
  - Added a chip strip "Tất cả · Chưa gắn · <topic.name>…" (each chip a shadcn `Button`, color dot when topic has color, `aria-pressed` for active state).
  - Reads `?vocabularyTopicId=<id|__none__>` on mount so deep-links from `/vocabulary/topics` cards land filtered.
  - Per-entry topic chip in the badge row, joined client-side from the cached topics list (NO extra backend join), color-tinted when `topic.color` is set.
- Edited `src/app/(app)/vocabulary/new/page.tsx` — fetches topics scoped to `user.language`; passes `topics` + `onTopicCreated` to `VocabularyForm`. Newly-created topic prepends to local cache and auto-selects.
- Edited `src/app/(app)/vocabulary/[id]/edit/page.tsx` — fetches topics scoped to `entry.language` (NOT `user.language`, per route-map line 35 and the backend's cross-language assignment rejection). Initial selection pre-filled from `entry.vocabularyTopicId`.
- Edited `src/app/(app)/vocabulary/study/page.tsx` — reads `?vocabularyTopicId=<id>` and threads it into the deck `useVocabulary` call. Heading shows a small Badge naming the active topic (or "Chưa gắn").

## Endpoints consumed (v8)
- `GET /api/vocabulary-topics?language=<L>` — `/vocabulary`, `/vocabulary/topics`, `/vocabulary/new`, `/vocabulary/[id]/edit`, `/vocabulary/study`.
- `POST /api/vocabulary-topics` — `/vocabulary/topics`, `/vocabulary/new` and `/vocabulary/[id]/edit` (inline create).
- `PATCH /api/vocabulary-topics/:id` — `/vocabulary/topics` (rename + color change).
- `DELETE /api/vocabulary-topics/:id` — `/vocabulary/topics`.
- `GET /api/vocabulary?vocabularyTopicId=<id|__none__>` — `/vocabulary`, `/vocabulary/study`.
- `POST /api/vocabulary` / `PUT /api/vocabulary/:id` — now thread `vocabularyTopicId` in the body.
- `POST /api/vocabulary/mine` — explicitly strips `vocabularyTopicId` per contract.

## QA checklist (heads-up for qa-inspector)
1. Chip strip on `/vocabulary` reflects `?vocabularyTopicId=` URL param on first paint.
2. Per-entry chip on `/vocabulary` renders only when the joined topic exists in the cached list (silent skip if a topic is unknown — e.g. mid-language switch race).
3. `/vocabulary/[id]/edit` topic options come from `entry.language`, not `user.language`. Editing a `zh` entry while studying `en` MUST show `zh` topics only.
4. Inline "+ Tạo chủ đề mới" on the form auto-selects the new topic after `201`.
5. 409 `TOPIC_NAME_CONFLICT` on create/rename: dialog stays open, typed name preserved, Vietnamese toast surfaced.
6. Delete: `ConfirmDialog` description includes the affected count from the bucketing pass.
7. `POST /api/vocabulary/mine` body MUST NOT include `vocabularyTopicId` — selection-popover strips it.
8. `/vocabulary/study?vocabularyTopicId=<id>` scopes the deck and shows the topic badge in the heading.
