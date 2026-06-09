# Design Spec — English Learning App (MVP)

UI language: **Vietnamese**. Learning content: **English**. Stack: Next.js App Router + Tailwind + shadcn/ui. This spec is implementable as-is; pair it with `route-map.md` (routes), `api-contract.md` (data), `data-model.md` (entities).

---

## 1. Design system tokens

### 1.1 Color (CSS variables, light theme; map to shadcn/ui `globals.css`)

| Token | Value (HSL) | Hex | Use |
|-------|-------------|-----|-----|
| `--background` | 0 0% 100% | #FFFFFF | page bg |
| `--foreground` | 222 47% 11% | #0F172A | body text |
| `--primary` | 221 83% 53% | #2563EB | primary actions, links, progress fill |
| `--primary-foreground` | 0 0% 100% | #FFFFFF | text on primary |
| `--secondary` | 210 40% 96% | #F1F5F9 | subtle surfaces |
| `--muted` | 210 40% 96% | #F1F5F9 | muted bg |
| `--muted-foreground` | 215 16% 47% | #64748B | secondary text |
| `--card` | 0 0% 100% | #FFFFFF | card surface |
| `--border` | 214 32% 91% | #E2E8F0 | borders, dividers |
| `--success` | 142 71% 45% | #22C55E | "đã thuộc", correct answer |
| `--destructive` | 0 72% 51% | #DC2626 | "chưa thuộc" emphasis, errors, wrong answer |
| `--warning` | 38 92% 50% | #F59E0B | partial/attention |
| `--ring` | 221 83% 53% | #2563EB | focus ring |

Dark theme is out of scope for MVP (ASSUMPTION). Define vars so it can be added later.

### 1.2 Typography

Font: **Inter** (latin + latin-ext covers Vietnamese diacritics) via `next/font`. Mono: none needed.

| Token | Size / line-height | Weight | Use |
|-------|--------------------|--------|-----|
| display | 36 / 40 | 700 | dashboard hero, big numbers |
| h1 | 30 / 36 | 700 | page titles |
| h2 | 24 / 32 | 600 | section headers |
| h3 | 20 / 28 | 600 | card titles |
| body | 16 / 24 | 400 | default |
| small | 14 / 20 | 400 | meta, captions |
| flashcard-front | 32 / 40 | 700 | English word on card front |
| flashcard-back | 18 / 28 | 400 | meaning + example |

### 1.3 Spacing & layout

- Base unit: 4px. Scale: 1=4, 2=8, 3=12, 4=16, 6=24, 8=32, 12=48.
- Page container: `max-w-5xl mx-auto px-4 md:px-6`, vertical rhythm `py-8`.
- Grid gap for card lists: `gap-4` (mobile) / `gap-6` (md+).

### 1.4 Radius & elevation

| Token | Value |
|-------|-------|
| `--radius` | 0.75rem (12px) base |
| card | rounded-xl |
| button/input | rounded-lg |
| shadow-card | `0 1px 3px rgba(0,0,0,0.08)` |
| shadow-flashcard | `0 4px 16px rgba(0,0,0,0.10)` |

### 1.5 Component inventory (shadcn/ui primitives)

| Primitive | Used in |
|-----------|---------|
| Button | everywhere (variants: default, secondary, outline, ghost, destructive) |
| Input, Label | auth forms |
| Card (+Header/Content/Footer) | topic cards, exercise cards, dashboard tiles, flashcard |
| Progress | topic completion bars, dashboard |
| Badge | topic % , reading level, known/unknown, correct/wrong |
| Tabs | (optional) reading detail: passage / questions |
| RadioGroup | reading question options |
| Toast (Sonner) | mark saved, reset done, submit result, errors |
| Avatar / DropdownMenu | top-nav user menu (logout) |
| Skeleton | loading states |
| Alert | error / empty states |
| Separator | layout dividers |

Custom composites (built from primitives): `Flashcard` (flip), `TopicCard`, `ReadingExerciseCard`, `QuestionItem`, `ScoreSummary`, `TopNav`, `ProgressStat`.

---

## 2. Global shell

### TopNav (`app/(app)/layout.tsx`)
```
┌────────────────────────────────────────────────────────────┐
│ [📚 EngLearn]   Tổng quan  Flashcard  Reading      (Avatar▾)│
└────────────────────────────────────────────────────────────┘
```
- Left: logo → `/dashboard`. Center/left links: "Tổng quan" `/dashboard`, "Flashcard" `/topics`, "Reading" `/reading`. Active link highlighted with `--primary`.
- Right: Avatar dropdown → user name/email + "Đăng xuất" (clears token, redirect `/login`).
- Mobile (<md): links collapse into a hamburger Sheet; logo + avatar stay.
- Guard: layout calls `GET /api/auth/me`; on 401 → redirect `/login`.

States: loading (Skeleton nav), error/401 (redirect).

---

## 3. Screens

### 3.1 `/register` — Đăng ký
Layout: centered Card (max-w-sm) on muted bg.
```
        ┌──────────────────────────┐
        │  Tạo tài khoản           │
        │  [Họ tên           ]     │
        │  [Email            ]     │
        │  [Mật khẩu         ]     │
        │  [   Đăng ký       ]     │  ← Button primary, full width
        │  Đã có tài khoản? Đăng nhập│
        └──────────────────────────┘
```
Components: Card, Label+Input ×3, Button, link to `/login`.
States: idle · submitting (button spinner, disabled) · field error (inline, from `VALIDATION_ERROR`) · `EMAIL_TAKEN` (toast + inline on email) · success (store token, redirect `/dashboard`).
Responsive: full-width card with side padding on mobile.

### 3.2 `/login` — Đăng nhập
Like register, fields Email + Mật khẩu. Link "Chưa có tài khoản? Đăng ký" → `/register`.
States: idle · submitting · `INVALID_CREDENTIALS` (toast "Email hoặc mật khẩu không đúng") · success → redirect `/dashboard`.

### 3.3 `/dashboard` — Tổng quan
Data: `GET /api/dashboard`.
```
Xin chào, {name} 👋
┌──────────┬──────────┬──────────┬──────────┐
│ Topics   │ Đã thuộc │ Hoàn thành│ Bài đã làm│   ← ProgressStat tiles (totals)
│   4      │  21/80   │   26%    │   5      │
└──────────┴──────────┴──────────┴──────────┘

Tiến độ theo topic                       (Xem tất cả →)
┌────────────────────────────────────────────────┐
│ Du lịch        ███████░░░░░░  35%   7/20 thẻ   │  ← TopicCard rows w/ Progress
│ Công việc      ████░░░░░░░░░  20%   4/20 thẻ   │
└────────────────────────────────────────────────┘

Bài reading gần đây
┌────────────────────────────────────────────────┐
│ City Life            4/5   08/06/2026   (Làm lại)│
└────────────────────────────────────────────────┘
```
Components: ProgressStat ×4, TopicCard list (from `topicProgress.items`), recent attempts list (from `recentAttempts.items`, link to `/reading/[exerciseSlug]`).
States: loading (Skeletons) · empty (no topics seeded → Alert "Chưa có nội dung") · empty attempts ("Bạn chưa làm bài reading nào — Bắt đầu") · error (Alert + retry).

### 3.4 `/topics` — Danh sách topic flashcard
Data: `GET /api/topics`.
Grid of TopicCard (1 col mobile / 2–3 col md+):
```
┌─────────────────────┐
│ Du lịch        35%  │  ← Badge %
│ Từ vựng du lịch     │
│ ███████░░░░  7/20 thẻ│  ← Progress
│ [ Học ngay ]        │  → /topics/travel
└─────────────────────┘
```
States: loading (Skeleton grid) · empty (Alert) · error.

### 3.5 `/topics/[slug]` — Học flashcard
Data: `GET /api/topics/:slug`. Mutations: `PUT /api/flashcards/:id/progress`, `POST /api/topics/:slug/progress/reset`.
```
← Quay lại    Du lịch · 7/20 đã thuộc · 35%        (↻ Reset ôn lại)
┌──────────────────────────────────────────┐
│                                          │
│                airport                   │  ← Flashcard FRONT (English, large)
│            (Nhấn để lật)                 │
│                                          │
└──────────────────────────────────────────┘
   ◀ Trước        Thẻ 3/20        Tiếp ▶

   [ ✗ Chưa thuộc ]        [ ✓ Đã thuộc ]   ← destructive / success
```
Flip → BACK shows: `back` (sân bay) + `example` (italic). Card uses CSS flip (`shadow-flashcard`).
Interaction:
- Click card / Space → flip.
- ◀ ▶ / arrow keys → prev/next card.
- "Đã thuộc"/"Chưa thuộc" → `PUT .../progress` with `{known}`, optimistic update of header counts, toast on save. Buttons reflect current `known`.
- "Reset ôn lại" → confirm dialog → `POST .../progress/reset` → all cards back to unknown, toast `resetCount`.
- Header counts/percent update live from mutation responses.
States: loading (Skeleton card) · empty (topic has 0 cards → Alert "Topic chưa có thẻ") · 404 (NotFound page) · mutation error (toast, revert optimistic) · all-known (subtle "Đã thuộc hết! 🎉" banner).
Responsive: card full-width on mobile; nav buttons stack below; mark buttons full-width side-by-side.

### 3.6 `/reading` — Danh sách bài reading
Data: `GET /api/reading-exercises`.
Grid/list of ReadingExerciseCard:
```
┌─────────────────────────────────────┐
│ City Life            [beginner]      │  ← Badge level
│ 5 câu hỏi · Điểm cao nhất: 4/5       │
│ [ Làm bài ]                          │  → /reading/city-life
└─────────────────────────────────────┘
```
`bestScore: null` → render "Chưa làm". States: loading · empty · error.

### 3.7 `/reading/[slug]` — Làm bài reading
Data: `GET /api/reading-exercises/:slug`. Submit: `POST /api/reading-exercises/:slug/attempts`.
```
← Quay lại    City Life  [beginner]                (Lịch sử)
┌──────────────── Passage ───────────────┐
│ Living in a big city has many ...       │  ← scrollable passage panel
└─────────────────────────────────────────┘

Câu 1. What does the passage mainly discuss?
 ( ) City life   ( ) Farming   ( ) Weather   ( ) Sports   ← RadioGroup
Câu 2. ...

              [ Nộp bài ]                         ← disabled until all answered (or allow with warning)
```
On submit → `ReadingAttemptResult`. UI switches to **review mode**:
```
Kết quả: 4/5 (80%)                         ← ScoreSummary
Câu 1 ✓  (your: City life — correct)
Câu 2 ✗  (your: Weather · đáp án đúng: Jobs)  ← correct=green, wrong=red
        [ Làm lại ]   [ Xem lịch sử ]
```
Interaction: track selected indices in local state → submit `{ answers: number[] }` aligned to question order; unanswered = `-1`. "Làm lại" resets local state to retake (new attempt on next submit). "Lịch sử"/"Xem lịch sử" → `/reading/[slug]/history`.
States: loading (Skeleton passage+questions) · 404 · submitting (button spinner) · submit error (toast) · review (graded).
Responsive: passage and questions stack single-column on mobile; options wrap.

### 3.8 `/reading/[slug]/history` — Lịch sử làm bài
Data: `GET /api/reading-exercises/:slug/attempts`.
```
← Quay lại    Lịch sử: City Life
┌──────────────────────────────────────┐
│ 09/06/2026 16:15     4/5   80%        │
│ 07/06/2026 21:00     3/5   60%        │
└──────────────────────────────────────┘
        [ Làm lại bài này ]   → /reading/[slug]
```
Newest first. States: loading · empty ("Bạn chưa làm bài này lần nào" + CTA) · 404 · error.

---

## 4. Cross-cutting states & rules

| State | Treatment |
|-------|-----------|
| Loading | shadcn Skeleton matching layout shape |
| Empty | Alert (muted) with a short Vietnamese message + primary CTA where relevant |
| Error | Alert destructive with `error.message` (Vietnamese from contract) + "Thử lại" |
| Unauthenticated (401) | redirect `/login` (handled in `(app)` layout) |
| Not found (404) | dedicated NotFound within the route segment, "Không tìm thấy" + back link |
| Toasts | success (save/reset/submit), error fallbacks |

Accessibility: focus-visible ring (`--ring`), keyboard for flashcard flip/nav, RadioGroup labels associated, color never the sole signal (pair ✓/✗ icons with green/red).

---

## 5. Responsive breakpoints

| Breakpoint | Behavior |
|-----------|----------|
| base (<768px) | single column; nav → hamburger Sheet; flashcard full-width; mark buttons side-by-side full width |
| md (≥768px) | container max-w-5xl; topic/exercise grids 2 col; inline nav links |
| lg (≥1024px) | topic grid 3 col; dashboard stat tiles in one row |
