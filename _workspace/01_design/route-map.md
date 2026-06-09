# Route Map — English Learning App (MVP)

> **v2 (2026-06-09): + My Vocabulary feature** — added `/vocabulary`, `/vocabulary/new`, `/vocabulary/[id]/edit`, `/vocabulary/study`; new TopNav item "Từ vựng của tôi". Dictionary auto-fill + TTS are CLIENT-ONLY. See DIFF at end.

Next.js App Router. UI language: **Vietnamese**. All data routes live under the `(app)` route group (authenticated shell); auth pages under `(auth)`.

Conventions:
- `(group)` segments are **stripped** from the URL (layout grouping only).
- `[param]` are dynamic segments → real URL value shown in the URL column.
- API base path: `/api/...` (see `api-contract.md`). Frontend reads `NEXT_PUBLIC_API_BASE_URL` for the Express backend origin.

---

## Route table (ordered by user flow)

| URL | `src/app/` path | Purpose | Data needs | Endpoints consumed |
|-----|-----------------|---------|-----------|--------------------|
| `/` | `app/page.tsx` | Landing → redirect: if authed → `/dashboard`, else `/login` | current auth state | `GET /api/auth/me` |
| `/register` | `app/(auth)/register/page.tsx` | Đăng ký (email, password, name) | none (writes) | `POST /api/auth/register` |
| `/login` | `app/(auth)/login/page.tsx` | Đăng nhập | none (writes) | `POST /api/auth/login` |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Tổng quan tiến độ: tiến độ flashcard theo từng topic + danh sách bài reading gần đây | per-topic progress, attempt summary | `GET /api/dashboard`, `GET /api/auth/me` |
| `/topics` | `app/(app)/topics/page.tsx` | Danh sách topic flashcard (kèm % hoàn thành) | topic list + per-user progress | `GET /api/topics` |
| `/topics/[slug]` | `app/(app)/topics/[slug]/page.tsx` | Học flashcard của 1 topic: lật thẻ, mark thuộc/chưa thuộc, reset | topic detail + cards + my progress | `GET /api/topics/:slug`, `PUT /api/flashcards/:id/progress`, `POST /api/topics/:slug/progress/reset` |
| `/reading` | `app/(app)/reading/page.tsx` | Danh sách bài tập reading (kèm best score) | exercise list + my best scores | `GET /api/reading-exercises` |
| `/reading/[slug]` | `app/(app)/reading/[slug]/page.tsx` | Làm bài reading: đọc passage, chọn đáp án, nộp, xem điểm + review | exercise detail (passage + questions, no answers) | `GET /api/reading-exercises/:slug`, `POST /api/reading-exercises/:slug/attempts` |
| `/reading/[slug]/history` | `app/(app)/reading/[slug]/history/page.tsx` | Lịch sử các lần làm của bài reading | attempts list for exercise | `GET /api/reading-exercises/:slug/attempts` |
| `/vocabulary` | `app/(app)/vocabulary/page.tsx` | Danh sách từ vựng cá nhân: search (word/meaning), lọc tag/partOfSpeech/favorite, sort; nút "+ Thêm từ", nút loa TTS mỗi từ, toggle ⭐, link sửa, nút xoá | entry list + my tags for filter dropdown | `GET /api/vocabulary`, `GET /api/vocabulary/tags`, `PUT /api/vocabulary/:id/favorite`, `DELETE /api/vocabulary/:id` |
| `/vocabulary/new` | `app/(app)/vocabulary/new/page.tsx` | Form thêm từ mới. Nút **"Tự điền từ điển"** gọi `api.dictionaryapi.dev` phía client để pre-fill, user chỉnh rồi lưu | none read; writes one entry | `POST /api/vocabulary` |
| `/vocabulary/[id]/edit` | `app/(app)/vocabulary/[id]/edit/page.tsx` | Form sửa từ. Tải entry để pre-fill, lưu cập nhật | single entry to edit | `GET /api/vocabulary/:id`, `PUT /api/vocabulary/:id` |
| `/vocabulary/study` | `app/(app)/vocabulary/study/page.tsx` | Học bộ từ cá nhân kiểu flashcard (reuse UX flashcard): front=word, back=meaning+example, mark thuộc/chưa thuộc, auto-advance, TTS | my full entry set (study deck) | `GET /api/vocabulary`, `PUT /api/vocabulary/:id/progress` |

---

## Client-only integrations (NOT in API contract) *(v2)*

These run entirely in the browser and never call the Express backend. They are intentionally absent from `api-contract.md`:

| Integration | Where | What |
|-------------|-------|------|
| Dictionary auto-fill | `/vocabulary/new` (and optionally edit) | `GET https://api.dictionaryapi.dev/api/v2/entries/en/<word>` (free, no key, CORS-OK) → pre-fill meaning/pronunciation/partOfSpeech/synonyms/exampleSentence into the form fields. User reviews/edits before submitting to `POST /api/vocabulary`. Handle 404 (word not found) gracefully. |
| Text-to-speech (TTS) | `/vocabulary`, `/vocabulary/study` | Web `window.speechSynthesis` reads the `word` aloud (loudspeaker button). No network, no backend. |

> ASSUMPTION: `/vocabulary/study` uses `GET /api/vocabulary` (full set, optionally filtered the same way as the list) as its deck — there is no dedicated "study deck" endpoint; the client builds the deck from the list and persists per-card state via `PUT /api/vocabulary/:id/progress`.

---

## Layouts / shells

| File | Role |
|------|------|
| `app/layout.tsx` | Root layout: html/body, Tailwind globals, fonts, Toaster |
| `app/(auth)/layout.tsx` | Centered card shell for login/register; redirects to `/dashboard` if already authed |
| `app/(app)/layout.tsx` | Authenticated shell: top nav (logo, links Dashboard/Topics/Reading/**Từ vựng của tôi** → `/vocabulary` *(v2)*, user menu/logout). Guards: no valid token → redirect `/login`. Loads `GET /api/auth/me` once. |

---

## Cross-check: every consumed endpoint exists in the contract

- `GET /api/auth/me` ✓
- `POST /api/auth/register` ✓
- `POST /api/auth/login` ✓
- `GET /api/dashboard` ✓
- `GET /api/topics` ✓
- `GET /api/topics/:slug` ✓
- `PUT /api/flashcards/:id/progress` ✓
- `POST /api/topics/:slug/progress/reset` ✓
- `GET /api/reading-exercises` ✓
- `GET /api/reading-exercises/:slug` ✓
- `POST /api/reading-exercises/:slug/attempts` ✓
- `GET /api/reading-exercises/:slug/attempts` ✓
- `GET /api/vocabulary` ✓ *(v2)*
- `POST /api/vocabulary` ✓ *(v2)*
- `GET /api/vocabulary/:id` ✓ *(v2)*
- `PUT /api/vocabulary/:id` ✓ *(v2)*
- `DELETE /api/vocabulary/:id` ✓ *(v2)*
- `PUT /api/vocabulary/:id/favorite` ✓ *(v2)*
- `PUT /api/vocabulary/:id/progress` ✓ *(v2)*
- `GET /api/vocabulary/tags` ✓ *(v2)*

No orphan routes, no orphan endpoints. Every contract endpoint below names a consuming screen.

---

## DIFF — v2 (My Vocabulary)

**4 new routes** (all inside the authed `(app)` shell):

| URL | File | Endpoints |
|-----|------|-----------|
| `/vocabulary` | `app/(app)/vocabulary/page.tsx` | `GET /api/vocabulary`, `GET /api/vocabulary/tags`, `PUT …/:id/favorite`, `DELETE …/:id` |
| `/vocabulary/new` | `app/(app)/vocabulary/new/page.tsx` | `POST /api/vocabulary` (+ client-only dictionary auto-fill) |
| `/vocabulary/[id]/edit` | `app/(app)/vocabulary/[id]/edit/page.tsx` | `GET …/:id`, `PUT …/:id` |
| `/vocabulary/study` | `app/(app)/vocabulary/study/page.tsx` | `GET /api/vocabulary`, `PUT …/:id/progress` (+ client-only TTS) |

**Nav:** TopNav in `app/(app)/layout.tsx` gains "Từ vựng của tôi" → `/vocabulary`.

**Client-only (no backend):** dictionary auto-fill (`api.dictionaryapi.dev`) on `/vocabulary/new`; TTS (`SpeechSynthesis`) on `/vocabulary` & `/vocabulary/study`. No existing routes changed.
