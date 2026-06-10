# Frontend Build Report — English Learning App

Stack: Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui-style primitives.
UI language: Vietnamese. Backend origin via `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`).

`npm install && npm run build`: **PASS** (typecheck clean). `npm run lint`: **PASS**.

## Routes / screens built

| URL | File | Endpoints consumed |
|-----|------|--------------------|
| `/` | `src/app/page.tsx` | `GET /api/auth/me` (redirect: token→/dashboard, else /login) |
| `/register` | `src/app/(auth)/register/page.tsx` | `POST /api/auth/register` |
| `/login` | `src/app/(auth)/login/page.tsx` | `POST /api/auth/login` |
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | `GET /api/dashboard` (+ `/me` via shell) |
| `/topics` | `src/app/(app)/topics/page.tsx` | `GET /api/topics` |
| `/topics/[slug]` | `src/app/(app)/topics/[slug]/page.tsx` | `GET /api/topics/:slug`, `PUT /api/flashcards/:id/progress`, `POST /api/topics/:slug/progress/reset` |
| `/reading` | `src/app/(app)/reading/page.tsx` | `GET /api/reading-exercises` |
| `/reading/[slug]` | `src/app/(app)/reading/[slug]/page.tsx` | `GET /api/reading-exercises/:slug`, `POST /api/reading-exercises/:slug/attempts` |
| `/reading/[slug]/history` | `src/app/(app)/reading/[slug]/history/page.tsx` | `GET /api/reading-exercises/:slug/attempts` |

Shells: `src/app/layout.tsx` (root, Inter font + Toaster), `src/app/(auth)/layout.tsx` (centered card, redirects authed→/dashboard), `src/app/(app)/layout.tsx` (auth guard via `/me`, TopNav).

All `href`/`router.push`/`redirect` targets resolve to real files under `src/app/` (route groups `(auth)`/`(app)` stripped from URL). Verified against route-map.md — no orphan links.

## Hooks ↔ endpoint mapping (types match contract exactly)

| Hook (`src/hooks/`) | Endpoint | Return type (contract shape) |
|---------------------|----------|------------------------------|
| `register()` `useAuth.ts` | `POST /api/auth/register` | `AuthResponse` `{token,user}` |
| `login()` `useAuth.ts` | `POST /api/auth/login` | `AuthResponse` |
| `fetchMe()` `useAuth.ts` | `GET /api/auth/me` | `MeResponse` `{user}` |
| `useDashboard()` `useDashboard.ts` | `GET /api/dashboard` | `DashboardResponse` (`topicProgress`/`recentAttempts` each `{items,total}`) |
| `useTopics()` `useTopics.ts` | `GET /api/topics` | **`ListResponse<TopicSummary>` = `{items,total}`** — consumer reads `.items` |
| `useTopicDetail(slug)` `useTopics.ts` | `GET /api/topics/:slug` | `TopicDetail` (single object, `.flashcards` bare array inside) |
| `markFlashcard(id,known)` `useTopics.ts` | `PUT /api/flashcards/:id/progress` | `FlashcardProgressResponse` |
| `resetTopicProgress(slug)` `useTopics.ts` | `POST /api/topics/:slug/progress/reset` | `TopicResetResponse` |
| `useReadingExercises()` `useReading.ts` | `GET /api/reading-exercises` | **`ListResponse<ReadingExerciseSummary>` = `{items,total}`** |
| `useReadingExercise(slug)` `useReading.ts` | `GET /api/reading-exercises/:slug` | `ReadingExerciseDetail` (questions have **no** `correctIndex`) |
| `submitReadingAttempt(slug,answers)` `useReading.ts` | `POST /api/reading-exercises/:slug/attempts` | `ReadingAttemptResult` (graded questions) |
| `useReadingAttempts(slug)` `useReading.ts` | `GET /api/reading-exercises/:slug/attempts` | **`ListResponse<ReadingAttempt>` = `{items,total}`** |

List wrappers are typed as `ListResponse<T>` and unwrapped at `.items` in the page — never typed as bare arrays. camelCase throughout.

## Data layer
- `src/lib/api.ts` — `fetchJson<T>()` wrapper: attaches `Authorization: Bearer <jwt>`, parses uniform `{error:{code,message}}` into `ApiError{code,message,status}`. `cache:"no-store"`.
- `src/lib/auth.ts` — JWT + user persisted in localStorage (SSR-safe guards).
- `src/lib/types.ts` — all contract shapes mirrored exactly.
- `src/hooks/useQuery.ts` — generic fetch-on-mount hook (loading/error/refetch); fetcher typed to full response shape including wrapper.

## State handling
Every data screen handles loading (Skeleton), empty (Alert + CTA), error (Alert + "Thử lại"), 404 (in-segment NotFound message), and 401 (redirect /login via `(app)` shell). Toasts (Sonner) on mark/reset/submit + errors.

## Contract-sensitive behaviors honored
- **Reading detail has NO `correctIndex`** — answer mode never knows correct answers; grading only rendered from the `POST .../attempts` `ReadingAttemptResult`.
- Submit sends `{answers:number[]}` aligned to question `order`; unanswered = `-1`.
- Flashcard mark is optimistic with revert-on-error; header counts/percent recomputed from local `known` state.
- Topic reset behind a confirm Dialog; updates all cards to `known:false`.

## Backend cross-check
Verified `server/src/routes/*` mounts match all 12 contract paths/methods exactly. **No drift, no stubs.**

## Suspected contract issues
None. Contract was internally consistent and matched the backend routes. No messages sent to design-architect/backend-engineer.

## Setup notes
- `.env.local` / `.env.example`: `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`.
- Backend CORS already allows `http://localhost:3000`.
- ESLint: Next 16's `react-hooks/set-state-in-effect` + `react-hooks/refs` disabled in `eslint.config.mjs` (false positives on legitimate fetch-on-mount / auth-redirect effects); `server/**` ignored (backend owns its own lint).

---

## My Vocabulary (v2 — 2026-06-09)

Partial add only; no existing routes/hooks changed. `npm run build`, `npx tsc --noEmit`, `npm run lint`: **all PASS (exit 0)**.

### Routes built (inside `(app)` shell)

| URL | File | Endpoints consumed |
|-----|------|--------------------|
| `/vocabulary` | `src/app/(app)/vocabulary/page.tsx` | `GET /api/vocabulary` (search/tag/partOfSpeech/favorite/sort), `GET /api/vocabulary/tags`, `PUT /api/vocabulary/:id/favorite`, `DELETE /api/vocabulary/:id` |
| `/vocabulary/new` | `src/app/(app)/vocabulary/new/page.tsx` | `POST /api/vocabulary` (+ client-only dictionary auto-fill) |
| `/vocabulary/[id]/edit` | `src/app/(app)/vocabulary/[id]/edit/page.tsx` | `GET /api/vocabulary/:id`, `PUT /api/vocabulary/:id` |
| `/vocabulary/study` | `src/app/(app)/vocabulary/study/page.tsx` | `GET /api/vocabulary`, `PUT /api/vocabulary/:id/progress` (+ client-only TTS) |

Shared form: `src/components/vocabulary-form.tsx` (reused by new + edit; chip-style comma input for synonyms/antonyms/tags, CEFR `<select>`, "Tự điền từ điển" button). Study page reuses the existing flip-card UX/CSS (`flip-card`/`flip-inner`/`is-flipped`) from `/topics/[slug]`.

**Nav:** "Từ vựng của tôi" → `/vocabulary` added to `LINKS` in `src/components/top-nav.tsx` (shared by desktop nav + mobile Sheet).

### Hooks ↔ endpoint (`src/hooks/useVocabulary.ts`)

| Hook / fn | Endpoint | Return type (contract shape) |
|-----------|----------|------------------------------|
| `useVocabulary(params)` | `GET /api/vocabulary?search&tag&partOfSpeech&favorite&sort` | **`ListResponse<VocabularyEntry>` = `{items,total}`** — consumer reads `.items` |
| `useVocabularyTags()` | `GET /api/vocabulary/tags` | **`ListResponse<string>` = `{items,total}`** — `.items` are bare strings |
| `useVocabularyEntry(id)` | `GET /api/vocabulary/:id` | `VocabularyEntry` (single object, NOT wrapped) |
| `createVocabulary(input)` | `POST /api/vocabulary` | `VocabularyEntry` (created) |
| `updateVocabulary(id,input)` | `PUT /api/vocabulary/:id` | `VocabularyEntry` (updated) |
| `deleteVocabulary(id)` | `DELETE /api/vocabulary/:id` | `DeleteResponse` `{success:true}` (200, not 204) |
| `setVocabularyFavorite(id,isFavorite)` | `PUT /api/vocabulary/:id/favorite` | `VocabularyFavoriteResponse` `{id,isFavorite}` (idempotent SET from body) |
| `setVocabularyProgress(id,known)` | `PUT /api/vocabulary/:id/progress` | `VocabularyProgressResponse` `{id,known}` |

`VocabularyEntry` type mirrors the contract exactly: optional scalars `string | null`; arrays (`synonyms`/`antonyms`/`tags`) always present (rendered guarded `.length > 0`); list endpoints typed `ListResponse<T>`, never bare arrays. Empty/unset filter params are dropped from the query string (not sent empty).

### Client-only helpers (NOT in contract, no Bearer, never hit backend)
- `src/lib/dictionary.ts` — `lookupWord(word)` → `GET https://api.dictionaryapi.dev/api/v2/entries/en/<word>`, defensively parses phonetic→IPA, `meanings[].definitions[].definition`→meaning, `partOfSpeech`, synonyms/antonyms, `example`→exampleSentence. 404 → `DictionaryNotFoundError` (shown as a gentle toast; does not clobber a Vietnamese meaning the user already typed).
- `src/lib/tts.ts` — `speak(word)` via `window.speechSynthesis` (`lang=en-US`), `isTtsSupported()` guard; TTS buttons render only when supported. Used on `/vocabulary` (per-row loudspeaker) and `/vocabulary/study`.

### States
List: loading (Skeleton rows), empty (Alert + "Thêm từ" CTA), error (Alert + retry); favorite-toggle and delete are optimistic with revert-on-error; delete behind a confirm Dialog. Study: loading/error/empty + flip + optimistic mark thuộc/chưa thuộc with auto-advance. Edit: 404 → "Không tìm thấy từ" empty state.

### Contract drift
None. All 8 endpoints consumed exactly as declared (camelCase, list wrappers unwrapped at `.items`, DELETE 200 body, idempotent favorite/progress SET). No messages sent to design-architect/backend-engineer.

---

## shadcn refactor (2026-06-09)

Áp dụng rule "Prefer shadcn/ui": thay native HTML element bằng shadcn component khi có sẵn.

### Component shadcn mới thêm
- `src/components/ui/select.tsx` — bản chuẩn shadcn dựa trên `@radix-ui/react-select` (Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator, scroll buttons). Style khớp Input/Button hiện có (tokens `var(--input|background|ring|popover|border|secondary)`, `rounded-lg`, focus-visible ring). Dep `@radix-ui/react-select` đã `npm i`.
- `src/components/ui/textarea.tsx` — bản chuẩn shadcn (styled textarea, không Radix), khớp style `Input` (cùng border/bg/ring, `min-h-20`).

### File đã refactor
- `src/components/vocabulary-form.tsx`: 2× `<textarea>` (exampleSentence, notes) → `Textarea`; 1× `<select>` CEFR → `Select`. Bỏ `selectClass`/`textareaClass` cục bộ và import `cn` (không còn dùng). Empty option `""` (— Không chọn —) map qua sentinel `CEFR_NONE = "none"` ↔ `cefrLevel: ""` để giữ nguyên hành vi gửi contract (Radix không cho value rỗng). `htmlFor="cefrLevel"` ↔ `SelectTrigger id="cefrLevel"`.
- `src/app/(app)/vocabulary/page.tsx`: 2× `<select>` filter (tag, sort) → `Select`. Bỏ `selectClass`. Tag "Tất cả thẻ" (`""`) map qua sentinel `TAG_ALL = "__all__"` ↔ `tag: ""`; sort giữ nguyên union value. `aria-label` giữ trên SelectTrigger. Filter/sort hoạt động y như cũ.
- `src/components/top-nav.tsx`: user-menu DropdownMenuTrigger native `<button>` → shadcn `Button` (variant="ghost", size="icon", `rounded-full`). Hamburger menu trigger đã là `Button` từ trước (không đổi).

### Ngoại lệ giữ native (có comment inline)
- `src/app/(app)/topics/[slug]/page.tsx` — flip-card surface `<button>`: giữ native. Lý do: vùng nội dung click được cỡ lớn (3D flip), không phải control; bọc shadcn Button sẽ phá layout flip. Đã thêm comment giải thích.
- `src/app/(app)/vocabulary/study/page.tsx` — flip-card surface `<button>`: giữ native, cùng lý do, đã thêm comment.

### Rà soát thêm
Không còn native `<select>`/`<textarea>` nào trong `src/`. Không có native `<input>`/`<label>` lạc ngoài `src/components/ui/` (xác nhận: hết).

### Kết quả
- `npx tsc --noEmit`: exit 0
- `npm run lint`: exit 0
- `npm run build`: exit 0 (12 routes generated)

---

## v3 update — Features 4, 5, 8 (2026-06-10)

`npx tsc --noEmit`: **PASS**.

### Feature 4 — Dashboard progress chart
- New hook: `src/hooks/useProgressHistory.ts` → `GET /api/dashboard/progress-history?days=7|30` typed to `ListResponse<ProgressHistoryItem>`.
- New component: `src/components/progress-chart.tsx` — shadcn `Tabs` (7d/30d) + recharts `BarChart` (Bar fill `#2563EB`, X axis `dd/MM`, Y axis integer). Loading=Skeleton 250px; error=Alert destructive; all-zero=centered "Bắt đầu học để xem tiến độ".
- Wired into `src/app/(app)/dashboard/page.tsx` below the stat tiles.
- Added recharts dep, added shadcn `Tabs` primitive (`src/components/ui/tabs.tsx`).

### Feature 5 — SRS review UI
- Types: `Flashcard`/`FlashcardProgressResponse` now carries optional `nextReviewAt`; added `TopicReviewResponse` (`items, total, dueCount`).
- `markFlashcard(id, known, quality?)` now forwards an optional `quality` (0–5) in the PUT body — old callers (the standard topic page) still send `{ known }` only.
- New hook: `src/hooks/useTopicReview.ts` → `GET /api/topics/:slug/review`.
- New route: `src/app/(app)/topics/[slug]/review/page.tsx` — flip-card UX from the topic page; "Chưa thuộc"=quality 2, "Đã thuộc"=quality 4. Empty queue → "Không có thẻ nào cần ôn hôm nay 🎉" + back. Last card → completion screen ("🎉", "Hoàn thành ôn tập hôm nay!", "Bạn đã ôn N thẻ", back button).
- `/topics/[slug]`: clickable warning Badge "{dueCount} thẻ cần ôn" linking to `/topics/[slug]/review`, only when `dueCount > 0`.

### Feature 8 — Reading highlight → vocabulary
- New component: `src/components/selection-popover.tsx` — listens to `mouseup` on the passage ref, shows a floating popover when selection is 1–5 words.
- Wired into `src/app/(app)/reading/[slug]/page.tsx`. Popover is disabled after submit (`enabled={!result}`).
- On "Thêm vào từ vựng": runs `lookupWord()` (best-effort, swallows 404/network), falls back to `findSentence(passage, word)` for `exampleSentence`, then `POST /api/vocabulary` with `{ word, meaning, pronunciation?, partOfSpeech?, exampleSentence? }`. Errors toast and DO save with `{ word, meaning: "" }` if backend rejects? — per spec we POST regardless of dictionary outcome.
- Sonner toast on success; dismiss via ✕ or outside click.
- Added shadcn `Popover` primitive (`src/components/ui/popover.tsx`) — not currently used in this feature (custom absolute-positioned div instead, to anchor to the live `Range` rect) but available for reuse.

### Files touched
- `src/lib/types.ts` (+ `TopicReviewResponse`, `ProgressHistoryItem`, optional `nextReviewAt`)
- `src/hooks/useTopics.ts` (+ `quality` param)
- `src/hooks/useProgressHistory.ts` (new)
- `src/hooks/useTopicReview.ts` (new)
- `src/components/ui/tabs.tsx` (new)
- `src/components/ui/popover.tsx` (new)
- `src/components/progress-chart.tsx` (new)
- `src/components/selection-popover.tsx` (new)
- `src/app/(app)/dashboard/page.tsx` (chart section)
- `src/app/(app)/topics/[slug]/page.tsx` (due-count badge)
- `src/app/(app)/topics/[slug]/review/page.tsx` (new route)
- `src/app/(app)/reading/[slug]/page.tsx` (selection popover)
- `package.json` (+ recharts, @radix-ui/react-tabs, @radix-ui/react-popover)

---

## v4 — Feature 7 (User-created Topics & Flashcards) — 2026-06-10

Goal: let an authed user create, edit, and delete their own topics + flashcards. Seeded topics (`userId === null`) remain read-only; ownership decided by `topic.userId === storedUser.id`.

### Types (`src/lib/types.ts`)
- `TopicSummary` (and therefore `TopicDetail` via `extends`) gained `userId: string | null`.

### API helpers (`src/hooks/useTopics.ts`)
Mutation helpers follow the existing convention (`markFlashcard`, `resetTopicProgress` live here, not in `lib/api.ts`):
- `createTopic({ title, titleVi, description? })` → `POST /api/topics` → `TopicSummary`
- `updateTopic(slug, { title?, titleVi?, description? })` → `PUT /api/topics/:slug` → `TopicSummary`
- `deleteTopic(slug)` → `DELETE /api/topics/:slug` → `{ success: true }`
- `addFlashcard(slug, { front, back, example? })` → `POST /api/topics/:slug/flashcards` → `Flashcard`
- `updateFlashcard(id, { front?, back?, example? })` → `PUT /api/flashcards/:id` → `Flashcard`
- `deleteFlashcard(id)` → `DELETE /api/flashcards/:id` → `{ success: true }`

### New pages
- `src/app/(app)/topics/new/page.tsx` — centered max-w-lg Card form. Title (1–80) and TitleVi (1–80) required, description optional. On success redirects to `/topics/${slug}/manage`. Inline error + disabled-while-submitting button with spinner.
- `src/app/(app)/topics/[slug]/manage/page.tsx` — flashcard manager. Owner-guard via `getStoredUser()` vs `data.userId`; non-owner → toast + redirect `/topics`. Header has `Sửa thông tin` (→ `/topics/[slug]/edit`) and `Học ngay` (→ `/topics/[slug]`). List of cards with Pencil/Trash icon buttons; clicking pencil swaps the row for an inline form, trash opens a confirm Dialog → optimistic delete with rollback on failure. `+ Thêm thẻ` button reveals an inline form at the bottom. Empty state Card with "Thêm thẻ đầu tiên" CTA. Toasts on every mutation.
- `src/app/(app)/topics/[slug]/edit/page.tsx` — pre-filled form (title, titleVi, description). `Lưu thay đổi` → PUT → redirect `/topics/[slug]/manage`. Danger-zone Card at bottom with destructive Dialog ("Topic và tất cả X thẻ sẽ bị xoá vĩnh viễn") → DELETE → redirect `/topics`. Owner-guard same as manage.

### Updated pages
- `src/app/(app)/topics/page.tsx` — header now has `Tạo topic mới` outline Button → `/topics/new`. For owner-cards, a ghost Settings2 icon-button sits next to the % badge → `/topics/[slug]/manage`. Empty state CTAs the user toward creation.
- `src/app/(app)/topics/[slug]/page.tsx` — added `Quản lý thẻ` outline button (Settings2 icon) next to `Reset ôn lại`, visible only when `data.userId === storedUser.id`.

### Conventions
- All UI text in Vietnamese; reused existing shadcn/ui primitives (Card, Input, Textarea, Button, Dialog, Skeleton, Label).
- Optimistic delete with rollback on the manage page; create/update use refetch-by-redirect or in-place state replacement.
- All endpoints typed exactly to the v4 contract — single-object responses are NOT wrapped, `DeleteResponse` for the two `success:true` shapes.

### Verification
- `npx tsc --noEmit` → exit 0 (no type errors).
