# Route Map — Multi-Language Learning App (MVP)

> **v6 (2026-06-13): + Chinese Learning Module (multi-language).** New route `/choose-language` (inside the `(app)` shell). The `(app)` layout guard now branches on `user.language`: `null` → redirect `/choose-language`; otherwise let the user through. TopNav grows a language switcher (DropdownMenu) showing the current language and offering to swap. All content routes (`/dashboard`, `/topics*`, `/reading*`, `/vocabulary*`) auto-scope to the user's current language — they pass `?language=<user.language>` to their list endpoints by default. The Chinese flashcard UI lives at the same `/topics/[slug]` route (no new route) — the page branches on `topic.language` in its render. Same for `/reading/[slug]`, `/vocabulary/new`, `/vocabulary/[id]/edit`. Admin reading routes (`/admin/reading*`) gain a language column + filter (`?language=all` allowed). UI language stays Vietnamese throughout. See v6 DIFF at end.
>
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
| `/` | `app/page.tsx` | Landing → redirect: if not authed → `/login`; else if `user.language IS NULL` → `/choose-language` *(v6)*; else `/dashboard` | current auth state + language | `GET /api/auth/me` |
| `/register` | `app/(auth)/register/page.tsx` | Đăng ký (email, password, name). On success the server returns `user.language: null` → redirect `/choose-language` *(v6)* | none (writes) | `POST /api/auth/register` |
| `/login` | `app/(auth)/login/page.tsx` | Đăng nhập. On success: if `user.language IS NULL` → `/choose-language` *(v6)*; else `/dashboard` | none (writes) | `POST /api/auth/login` |
| `/choose-language` *(v6)* | `app/(app)/choose-language/page.tsx` | Language gate. Two large cards: "Học Tiếng Anh 🇬🇧" / "Học Tiếng Trung 🇨🇳". Tap → `PUT /api/users/me/language` → cache user → redirect `/dashboard`. Re-entry while `language !== null` is allowed (used by the TopNav switcher) and the current choice is highlighted. **Bypasses the language-gate branch** in the `(app)` layout — this is the only `(app)` page reachable while `user.language === null`. | current user.language | `GET /api/auth/me`, `PUT /api/users/me/language` |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Tổng quan tiến độ scoped to current language: tiến độ flashcard theo từng topic + danh sách bài reading gần đây. *(v6)* Auto-passes `?language=<user.language>` to the dashboard endpoint. | per-topic progress, attempt summary | `GET /api/dashboard?language=<user.language>`, `GET /api/dashboard/progress-history?days=7&language=<user.language>`, `GET /api/auth/me` |
| `/topics` | `app/(app)/topics/page.tsx` | Danh sách topic flashcard scoped to current language (kèm % hoàn thành) | topic list + per-user progress | `GET /api/topics?language=<user.language>` |
| `/topics/[slug]` | `app/(app)/topics/[slug]/page.tsx` | Học flashcard của 1 topic: lật thẻ, mark thuộc/chưa thuộc, reset. *(v6)* Page branches on `topic.language`: English flashcard UI vs Chinese flashcard UI (Hán tự lớn, pinyin + nghĩa + ví dụ song ngữ trên mặt sau, TTS `zh-CN`). | topic detail + cards + my progress | `GET /api/topics/:slug`, `PUT /api/flashcards/:id/progress`, `POST /api/topics/:slug/progress/reset` |
| `/reading` | `app/(app)/reading/page.tsx` | Danh sách bài tập reading scoped to current language (kèm best score) | exercise list + my best scores | `GET /api/reading-exercises?language=<user.language>` |
| `/reading/[slug]` | `app/(app)/reading/[slug]/page.tsx` | Làm bài reading: đọc passage, chọn đáp án, nộp, xem điểm + review. *(v6)* Page branches on `exercise.language`: passage container uses `lang="en"` vs `lang="zh-CN"` (helps TTS, screen-readers, font hinting). | exercise detail (passage + questions, no answers) | `GET /api/reading-exercises/:slug`, `POST /api/reading-exercises/:slug/attempts` |
| `/reading/[slug]/history` | `app/(app)/reading/[slug]/history/page.tsx` | Lịch sử các lần làm của bài reading | attempts list for exercise | `GET /api/reading-exercises/:slug/attempts` |
| `/vocabulary` | `app/(app)/vocabulary/page.tsx` | Danh sách từ vựng cá nhân scoped to current language: search (word/meaning, *(v6)* + pinyin for `zh`), lọc tag/partOfSpeech/favorite/cefrLevel/hskLevel *(v6)*, sort; nút "+ Thêm từ", nút loa TTS mỗi từ (`en-US`/`zh-CN`), toggle ⭐, link sửa, nút xoá. *(v6)* HSK badge component renders when entry has `hskLevel`. | entry list + my tags for filter dropdown | `GET /api/vocabulary?language=<user.language>`, `GET /api/vocabulary/tags?language=<user.language>`, `PUT /api/vocabulary/:id/favorite`, `DELETE /api/vocabulary/:id` |
| `/vocabulary/new` | `app/(app)/vocabulary/new/page.tsx` | Form thêm từ mới. *(v6)* Page branches on `user.language`: English form (CEFR + dictionary auto-fill) vs Chinese form (pinyin input + HSK 1–6 select; no dictionary auto-fill — out of scope). Nút **"Tự điền từ điển"** chỉ hiển thị khi `user.language === "en"`. | none read; writes one entry | `POST /api/vocabulary` (body includes `language: <user.language>`) |
| `/vocabulary/[id]/edit` | `app/(app)/vocabulary/[id]/edit/page.tsx` | Form sửa từ. Tải entry để pre-fill, lưu cập nhật. *(v6)* Branches on `entry.language` (NOT `user.language` — the entry's language is immutable, so editing a `zh` entry while currently studying `en` is still allowed and shows the Chinese form). | single entry to edit | `GET /api/vocabulary/:id`, `PUT /api/vocabulary/:id` |
| `/vocabulary/study` | `app/(app)/vocabulary/study/page.tsx` | Học bộ từ cá nhân kiểu flashcard scoped to current language (reuse UX flashcard): front=word, back=meaning+example, mark thuộc/chưa thuộc, auto-advance, TTS. *(v6)* Chinese variant uses Hán tự front + pinyin/meaning back + `zh-CN` TTS. | my full entry set (study deck) | `GET /api/vocabulary?language=<user.language>`, `PUT /api/vocabulary/:id/progress` |

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
| `app/(app)/layout.tsx` | Authenticated shell: top nav (logo, links Dashboard/Topics/Reading/**Từ vựng của tôi** → `/vocabulary` *(v2)*, *(v6)* language switcher DropdownMenu showing current 🇬🇧/🇨🇳 + "Chuyển sang …"; user menu/logout). Guards: no valid token → redirect `/login`. *(v6)* Loads `GET /api/auth/me` once; if `user.language === null` AND the current pathname is NOT `/choose-language` → redirect `/choose-language`. The `/choose-language` route renders inside this layout but BYPASSES the language gate (special-case in the guard). On a `403 LANGUAGE_NOT_SELECTED` from any data hook, also redirect `/choose-language` (defensive — the gate should already have caught it). |

---

## Cross-check: every consumed endpoint exists in the contract

- `GET /api/auth/me` ✓
- `POST /api/auth/register` ✓
- `POST /api/auth/login` ✓
- `PUT /api/users/me/language` ✓ *(v6)*
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

---

## DIFF — v6 (Multi-Language: Chinese Learning Module)

### 1 new route (inside the authed `(app)` shell)

| URL | File | Endpoints |
|-----|------|-----------|
| `/choose-language` | `app/(app)/choose-language/page.tsx` | `GET /api/auth/me`, `PUT /api/users/me/language` |

This is the only `(app)` route reachable while `user.language === null` — it bypasses the language gate so the user can set their preference.

### Auth redirect logic (updated)

The redirect tree from auth pages and the root:

```
/                        → not authed                → /login
                         → authed, language === null → /choose-language    (v6)
                         → authed, language set      → /dashboard

/login on success        → user.language === null    → /choose-language    (v6)
                         → user.language set         → /dashboard

/register on success     → user.language is always null → /choose-language (v6)

/choose-language on save → /dashboard

(app) layout guard       → no token                  → /login
                         → user.language === null AND pathname !== /choose-language → /choose-language  (v6)
                         → any data hook returns 403 LANGUAGE_NOT_SELECTED → /choose-language (defensive)
```

### TopNav — language switcher

`app/(app)/layout.tsx` TopNav adds a DropdownMenu (between "Từ vựng của tôi" and the user Avatar):
- Trigger: small button showing the current language label + flag — `🇬🇧 Tiếng Anh` / `🇨🇳 Tiếng Trung`.
- Menu items: the other language (with flag) and "Đổi ngôn ngữ học" (link to `/choose-language` for the visual two-card picker).
- On click: `PUT /api/users/me/language { language: <other> }` → on 200, update the cached `user` (TanStack Query `auth.me`) → invalidate all language-scoped query keys (`topics.list`, `reading.list`, `dashboard`, `vocabulary.list`, `vocabulary.tags`, `dashboard.progressHistory`) → router.push current route OR `/dashboard` if the current route is `/topics/[slug]` / `/reading/[slug]` (those resources may not exist in the new language).
- Mobile: language switcher moves into the hamburger Sheet, same items.

### All existing content routes — query param threading

The following routes pass `?language=<user.language>` to their list endpoint by default. The frontend `apiClient` SHOULD auto-inject this from a shared `useCurrentLanguage()` hook so individual hooks don't repeat themselves:

| Route | Endpoint (v6 form) |
|-------|--------------------|
| `/dashboard` | `GET /api/dashboard?language=<L>`, `GET /api/dashboard/progress-history?days=7&language=<L>` |
| `/topics` | `GET /api/topics?language=<L>` |
| `/reading` | `GET /api/reading-exercises?language=<L>` |
| `/vocabulary` | `GET /api/vocabulary?language=<L>`, `GET /api/vocabulary/tags?language=<L>` |
| `/vocabulary/study` | `GET /api/vocabulary?language=<L>` |
| `/vocabulary/new` (POST body) | `POST /api/vocabulary { …, language: <L> }` |

Single-resource detail routes (`/topics/[slug]`, `/reading/[slug]`, `/vocabulary/[id]/edit`) do **not** pass language — they fetch by id/slug and use the response's `language` field to pick the UI variant.

### Page-level variants (no new routes — branch on `topic.language` / `exercise.language` / `entry.language`)

| Route | Variant trigger | Variant changes |
|-------|----------------|----------------|
| `/topics/[slug]` | `topic.language === "zh"` | Hán tự front (font-size ~64px), pinyin + meaning + bilingual example on back, TTS `lang="zh-CN"`. See `design-spec.md` §3.5 v6. |
| `/reading/[slug]` | `exercise.language === "zh"` | Passage container `lang="zh-CN"`; question prompts may include both Hán tự and pinyin (admin-authored); TTS `zh-CN` for any read-aloud. |
| `/vocabulary/new` | `user.language === "zh"` | Pinyin input + HSK 1–6 select; no CEFR; no dictionary auto-fill. |
| `/vocabulary/[id]/edit` | `entry.language === "zh"` | Same Chinese form as `/vocabulary/new`. `language` field is read-only (immutable on PUT). |
| `/vocabulary` (list) | per-item `entry.language === "zh"` | HSK badge replaces CEFR badge; pinyin shown under word; TTS button uses `zh-CN`. |
| `/vocabulary/study` | per-item `entry.language === "zh"` | Chinese flashcard layout (Hán tự front, pinyin+meaning back). |

### Admin routes (v5) — language column

Admin reading routes (`/admin/reading`, `/admin/reading/new`, `/admin/reading/[slug]/edit`) gain:
- A `language` column in the list table.
- A language select (Tiếng Anh / Tiếng Trung) in the create form.
- A language filter in the list (`?language=en|zh|all`; `all` reserved for admins; default `=<user.language>`).
- The edit form shows `language` as a read-only field (immutable after create).

### Client-only integrations (updated for v6)

| Integration | Where | What |
|-------------|-------|------|
| Dictionary auto-fill | `/vocabulary/new` (English only) | `GET https://api.dictionaryapi.dev/api/v2/entries/en/<word>` — pre-fills meaning/pronunciation/partOfSpeech/synonyms/example. Hidden when `user.language === "zh"` (no equivalent Chinese dictionary in scope). |
| TTS — English | `/vocabulary`, `/vocabulary/study`, English flashcards | `SpeechSynthesisUtterance.lang = "en-US"`. |
| TTS — Chinese *(v6)* | `/vocabulary`, `/vocabulary/study`, Chinese flashcards, `/reading/[slug]` (Chinese passages) | `SpeechSynthesisUtterance.lang = "zh-CN"`. The shared TTS helper at `src/lib/tts.ts` accepts a `lang` arg; all call sites pass it from the local resource's `language` field. |

### Frontend data-layer note

A single `useCurrentLanguage()` hook reads `user.language` from the cached `/api/auth/me` query. Every list/dashboard hook reads it once and threads it into the endpoint as `?language=<value>`. When the user switches language via TopNav:
1. `PUT /api/users/me/language` is fired and waited on.
2. On 200, the auth.me cache is updated with the new `user.language`.
3. Every language-scoped query key is invalidated (or removed) → all data re-fetches under the new language automatically.
4. The route stays the same UNLESS it's a `[slug]` or `[id]` detail route — then router.push back to `/dashboard` because the resource may not exist in the new language.

### No orphans

The new `/choose-language` route consumes 2 existing/new endpoints (`GET /api/auth/me`, `PUT /api/users/me/language`). The new `PUT /api/users/me/language` endpoint has exactly one screen consumer: `/choose-language` (plus the TopNav switcher, which is part of the `(app)` layout — not a route, so it's tracked in this DIFF rather than the route table).
