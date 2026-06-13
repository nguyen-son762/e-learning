# Design Spec — Multi-Language Learning App (MVP)

UI language: **Vietnamese**. Learning content: **English OR Mandarin Chinese (Simplified)** — user picks one and can switch any time. Stack: Next.js App Router + Tailwind + shadcn/ui. This spec is implementable as-is; pair it with `route-map.md` (routes), `api-contract.md` (data), `data-model.md` (entities).

> **v6 (2026-06-13): + Chinese Learning Module.** Adds new tokens (`flashcard-hanzi`, tone-mark color, HSK badge palette), new components (`LanguageGate`, `LanguageSwitcher`, `HskBadge`, `ToneBadge`, `PinyinText`), the `/choose-language` screen (§3.0 v6), and a Chinese variant of the flashcard screen (§3.5 v6). TopNav (§2 v6) gains a language switcher. Vocabulary form (§3.9 v6 — covering `/vocabulary/new` + `/vocabulary/[id]/edit`) branches on the entry/user language. UI language stays Vietnamese. See v6 DIFF at end.

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
| `--tone-1` *(v6)* | 0 0% 11% | #1C1C1C | flat tone (mā) — pinyin tone-1 mark color |
| `--tone-2` *(v6)* | 142 71% 35% | #1A8242 | rising (má) — green |
| `--tone-3` *(v6)* | 38 92% 45% | #C77F00 | dip (mǎ) — amber |
| `--tone-4` *(v6)* | 0 72% 51% | #DC2626 | falling (mà) — red |
| `--tone-5` *(v6)* | 215 16% 47% | #64748B | neutral (ma) — muted gray |
| `--hsk-1` *(v6)* | 142 71% 92% / 142 71% 25% | bg/fg | HSK 1 badge — light green bg, dark green fg |
| `--hsk-2` *(v6)* | 199 89% 92% / 199 89% 30% | bg/fg | HSK 2 — light blue |
| `--hsk-3` *(v6)* | 271 80% 92% / 271 80% 35% | bg/fg | HSK 3 — light purple |
| `--hsk-4` *(v6)* | 38 92% 92% / 38 92% 35% | bg/fg | HSK 4 — light amber |
| `--hsk-5` *(v6)* | 16 88% 92% / 16 88% 38% | bg/fg | HSK 5 — light orange |
| `--hsk-6` *(v6)* | 0 72% 92% / 0 72% 38% | bg/fg | HSK 6 — light red |

Dark theme is out of scope for MVP (ASSUMPTION). Define vars so it can be added later.

*(v6)* Tone-mark colors are used by the `ToneBadge` component and by the `PinyinText` composite when rendering the tone numeral indicator. HSK badge palette uses the same shape as the existing `Badge` shadcn component — just per-level bg/fg pairs.

### 1.2 Typography

Font: **Inter** (latin + latin-ext covers Vietnamese diacritics) via `next/font`. Mono: none needed.

*(v6)* For Hán tự rendering, add **Noto Sans SC** (`next/font/google` subset `chinese-simplified`) and use it ONLY on the Hanzi node — body text stays Inter. The font-family chain on the Hanzi node: `"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`. Apply via the `PinyinText` / `HanziText` composites (see component inventory), not globally — keeps Inter as the primary face for all Vietnamese UI text.

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
| flashcard-hanzi *(v6)* | 64 / 72 | 700 | Hán tự (Simplified Hanzi) on Chinese flashcard front — uses a CJK-capable font (Noto Sans SC fallback chain) |
| flashcard-pinyin *(v6)* | 22 / 28 | 500 | Pinyin with tone marks on Chinese flashcard back; rendered above meaning |

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

*(v6)* Additional custom composites:
- **`LanguageGate`** — the two-card chooser on `/choose-language`. Renders two big `Card`s (English / Chinese) side-by-side on md+, stacked on mobile. Each card: large flag emoji (5xl), language name in Vietnamese, brief description, primary button. The currently-selected language (if any) renders with `--success` border and a "Đang học" badge.
- **`LanguageSwitcher`** — DropdownMenu trigger in TopNav. Shows current flag + language label. Menu items: the other language (with flag), and "Đổi ngôn ngữ học" → links to `/choose-language`.
- **`HskBadge`** — Badge variant displaying "HSK 1"…"HSK 6" with per-level palette from `--hsk-*`. Drop-in replacement for the CEFR Badge on `zh` entries.
- **`ToneBadge`** — tiny circular badge (1.5rem) showing the tone numeral 1–5 colored by `--tone-*`. Optional decoration next to pinyin syllables.
- **`PinyinText`** — wraps a pinyin string (e.g. `"nǐ hǎo"`) in a span with the `flashcard-pinyin` typography token, `lang="zh-Latn-pinyin"` for screen-readers, and applies the CJK font fallback chain.
- **`HanziText`** — wraps Hán tự content with `flashcard-hanzi` typography, `lang="zh-CN"`, and the CJK font fallback chain. Used on the flashcard front, vocabulary list word column, and reading passage.
- **`ChineseFlashcardFront` / `ChineseFlashcardBack`** — variants of the existing Flashcard composite, selected by branching on `topic.language` (or `entry.language` in the vocabulary study screen). See §3.5 v6.

---

## 2. Global shell

### TopNav (`app/(app)/layout.tsx`)
```
┌──────────────────────────────────────────────────────────────────────┐
│ [📚 Học] Tổng quan Flashcard Reading Từ vựng   [🇨🇳 Tiếng Trung ▾] (👤▾)│
└──────────────────────────────────────────────────────────────────────┘
```
- Left: logo → `/dashboard`. Center/left links: "Tổng quan" `/dashboard`, "Flashcard" `/topics`, "Reading" `/reading`, "Từ vựng của tôi" `/vocabulary` *(v2)*. Active link highlighted with `--primary`.
- Right: *(v6)* **`LanguageSwitcher`** Dropdown (flag + current language) → menu items: the other language (one-click switch — fires `PUT /api/users/me/language`, then invalidates language-scoped queries and stays on the same route OR redirects to `/dashboard` if the current route is a `[slug]`/`[id]` detail page) + "Đổi ngôn ngữ học" linking to `/choose-language`.
- Right: Avatar dropdown → user name/email + "Đăng xuất" (clears token, redirect `/login`).
- Mobile (<md): all of {links, language switcher} collapse into a hamburger Sheet; logo + avatar stay visible. The language switcher in the Sheet renders as a labeled select-style row, not a dropdown.
- Guard: layout calls `GET /api/auth/me`; on 401 → redirect `/login`. *(v6)* If `user.language === null` AND `pathname !== "/choose-language"` → redirect `/choose-language`. The `/choose-language` route bypasses this gate.

States: loading (Skeleton nav), error/401 (redirect). *(v6)* During the in-flight `PUT /api/users/me/language`, the LanguageSwitcher trigger shows a small spinner and is disabled.

---

## 3. Screens

### 3.0 `/choose-language` — Chọn ngôn ngữ học  *(v6)*
Data: `GET /api/auth/me` (current selection — used to highlight). Mutation: `PUT /api/users/me/language`.

Layout: centered hero on the `(app)` shell (TopNav is rendered above, but the language switcher trigger is suppressed here since the user is choosing on the page itself).

```
                  Bạn muốn học ngôn ngữ nào?
       Có thể đổi bất cứ lúc nào qua menu phía trên.

   ┌───────────────────────────┐   ┌───────────────────────────┐
   │                           │   │                           │
   │           🇬🇧              │   │           🇨🇳              │
   │                           │   │                           │
   │     Học Tiếng Anh         │   │     Học Tiếng Trung       │
   │     CEFR A1 → C2          │   │     HSK 1 → 3 (MVP)       │
   │  Từ vựng, đọc hiểu, SRS   │   │  Hán tự, pinyin, SRS      │
   │                           │   │                           │
   │     [   Bắt đầu   ]       │   │     [   Bắt đầu   ]       │
   │                           │   │                           │
   └───────────────────────────┘   └───────────────────────────┘
```

Components: `LanguageGate` composite — 2 large `Card`s in a `grid grid-cols-1 md:grid-cols-2 gap-6`, each clickable on its entire surface (the inner button is a visual affordance; the whole card is the click target for ergonomics).

Behavior:
- The card matching the current `user.language` (if any) renders with `border-2 border-[--success]` and a "Đang học" `Badge` above the title — so re-visitors clearly see their current choice.
- Click → optimistic select state on the card → fire `PUT /api/users/me/language { language: <chosen> }` → on 200, update the cached `/api/auth/me` query → router.push `/dashboard`.
- Keyboard: Tab between the 2 cards, Enter/Space to select; focus ring (`--ring`).

States:
- Loading (`/api/auth/me` in flight): show a Skeleton banner above the cards while the cards render disabled.
- Submitting: the chosen card shows a spinner inside the button, both cards are disabled.
- Error from PUT: Toast (destructive) with `error.message`; cards re-enable; selection state reverts.
- Re-entry from TopNav while `user.language` already set: full functionality; choosing the same language is a no-op (200 returned, redirect to `/dashboard` anyway).

Responsive:
- `<md`: cards stack vertically, full-width with `py-12` between them and a sticky CTA at the bottom of each card.
- `>=md`: 2 columns, equal width, `gap-6`.

Accessibility:
- `aria-label` on each card: "Chọn học Tiếng Anh" / "Chọn học Tiếng Trung".
- `aria-pressed` reflects the current selection.
- Flag emojis carry `role="img"` + Vietnamese `aria-label` (e.g. `"Quốc kỳ Anh"`).

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
States: idle · submitting (button spinner, disabled) · field error (inline, from `VALIDATION_ERROR`) · `EMAIL_TAKEN` (toast + inline on email) · success (store token, *(v6)* redirect `/choose-language` — newly-registered users always have `user.language === null`).
Responsive: full-width card with side padding on mobile.

### 3.2 `/login` — Đăng nhập
Like register, fields Email + Mật khẩu. Link "Chưa có tài khoản? Đăng ký" → `/register`.
States: idle · submitting · `INVALID_CREDENTIALS` (toast "Email hoặc mật khẩu không đúng") · success → *(v6)* if `user.language === null` redirect `/choose-language`, else redirect `/dashboard`.

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

The screen **branches on `topic.language`** *(v6)*. Both variants share the same shell (header counts, nav buttons, mark buttons, reset dialog, keyboard shortcuts); only the flashcard front/back rendering differs.

#### 3.5a English variant (`topic.language === "en"`)
```
← Quay lại    Du lịch · 7/20 đã thuộc · 35%        (↻ Reset ôn lại)
┌──────────────────────────────────────────┐
│                                          │
│                airport                   │  ← Flashcard FRONT (English, large — flashcard-front token)
│            (Nhấn để lật)                 │
│                                          │
└──────────────────────────────────────────┘
   ◀ Trước        Thẻ 3/20        Tiếp ▶

   [ ✗ Chưa thuộc ]        [ ✓ Đã thuộc ]   ← destructive / success
```
Flip → BACK shows: `back` (sân bay) + `example` (italic). Card uses CSS flip (`shadow-flashcard`).

#### 3.5b Chinese variant (`topic.language === "zh"`)  *(v6)*
```
← Quay lại    Chào hỏi · 5/12 đã thuộc · 41%        (↻ Reset ôn lại)
┌──────────────────────────────────────────┐
│                                          │
│                 你 好                    │  ← HanziText, flashcard-hanzi (64px), lang="zh-CN"
│              [🔊]  (Nhấn để lật)         │  ← TTS button (top-right), reads zh-CN
│                                          │
└──────────────────────────────────────────┘
   ◀ Trước        Thẻ 3/12        Tiếp ▶

   [ ✗ Chưa thuộc ]        [ ✓ Đã thuộc ]
```

Flip → BACK:
```
┌──────────────────────────────────────────┐
│                                          │
│   nǐ hǎo                                 │  ← PinyinText (flashcard-pinyin token, 22px)
│   xin chào                               │  ← Vietnamese meaning (body, 18px)
│   ─────────────────                      │
│   你好，我叫小明。                        │  ← Bilingual example: Hán tự
│   nǐ hǎo, wǒ jiào xiǎo míng.             │  ← pinyin (italic, muted)
│   Chào, mình tên Tiểu Minh.              │  ← Vietnamese gloss (small, muted-foreground)
│                                          │
└──────────────────────────────────────────┘
```

**Parsing convention:** the card stores `back` as `"pinyin — Vietnamese meaning"` (e.g. `"nǐ hǎo — xin chào"`) and `example` as `"<Chinese sentence> (<pinyin>) — <Vietnamese gloss>"`. The frontend `parseChineseCardBack(back)` and `parseChineseCardExample(example)` helpers split on `" — "` and `(…)` respectively. If parsing fails (legacy/admin-malformed cards), fall back to rendering the raw string as-is below a small Alert hint "Định dạng thẻ không chuẩn".

**TTS:** the speaker button on the front (and a second one on the back, next to the example) uses `SpeechSynthesisUtterance` with `lang = "zh-CN"`. The shared helper `src/lib/tts.ts` accepts a `lang` arg; this page passes `topic.language === "zh" ? "zh-CN" : "en-US"`.

Interaction (both variants):
- Click card / Space → flip.
- ◀ ▶ / arrow keys → prev/next card.
- "Đã thuộc"/"Chưa thuộc" → `PUT .../progress` with `{known}`, optimistic update of header counts, toast on save. Buttons reflect current `known`.
- "Reset ôn lại" → confirm dialog → `POST .../progress/reset` → all cards back to unknown, toast `resetCount`.
- Header counts/percent update live from mutation responses.
- *(v6)* Chinese: speaker button stops event propagation (does NOT flip the card). Keyboard shortcut `T` triggers TTS on the visible face.

States: loading (Skeleton card) · empty (topic has 0 cards → Alert "Topic chưa có thẻ") · 404 (NotFound page) · mutation error (toast, revert optimistic) · all-known (subtle "Đã thuộc hết! 🎉" banner). *(v6)* TTS-unavailable (browser without SpeechSynthesis or no zh-CN voice installed): the speaker button is disabled with a Tooltip "Trình duyệt không hỗ trợ đọc tiếng Trung".

Responsive: card full-width on mobile; nav buttons stack below; mark buttons full-width side-by-side. *(v6)* Chinese variant: Hanzi font-size steps DOWN to 56px on `<md` to avoid overflow on long compound words.

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

---

## DIFF — v6 (Multi-Language: Chinese Learning Module)

### New design tokens

- **Typography**: `flashcard-hanzi` (64/72, 700) and `flashcard-pinyin` (22/28, 500) — Hanzi front and pinyin back of Chinese flashcards. Hanzi uses Noto Sans SC + CJK fallback chain; pinyin uses Inter (latin extended covers diacritics).
- **Colors — tones**: `--tone-1`..`--tone-5` for tone-mark coloration. `--tone-3` and `--tone-4` reuse existing warning/destructive hues for consistency.
- **Colors — HSK badges**: `--hsk-1`..`--hsk-6` bg/fg pairs, used by the `HskBadge` composite. Same shape as the existing shadcn `Badge` — no new primitive.

### New screens

- **§3.0 `/choose-language`** — language gate. Two big cards (English / Chinese), tap to select, fires `PUT /api/users/me/language`. Reachable on first login and via the TopNav switcher.

### Modified screens (existing screens — no new routes, only render variants based on `*.language`)

- **§3.1 `/register`** — on success redirect `/choose-language` (new users always have `language === null`).
- **§3.2 `/login`** — on success branch: `null` → `/choose-language`; set → `/dashboard`.
- **§3.5 `/topics/[slug]`** — branches on `topic.language` between the existing English flashcard (§3.5a) and the new Chinese variant (§3.5b: Hanzi 64px front, pinyin + meaning + bilingual example back, `zh-CN` TTS).
- **§2 TopNav** — adds the `LanguageSwitcher` Dropdown between "Từ vựng của tôi" and the user Avatar. Switches the user's language one-click and invalidates language-scoped queries.

### Implicit variants (no diagram changes, but render branches added)

- **§3.6 `/reading` and §3.7 `/reading/[slug]`** — passage and question containers carry `lang="en"` vs `lang="zh-CN"`. The Chinese variant uses `HanziText` for the passage, and the `level` Badge values are `HSK1`/`HSK2`/`HSK3` instead of `beginner`/`intermediate`/`advanced`.
- **`/vocabulary` (list)** — replaces CEFR Badge with `HskBadge` when `entry.language === "zh"`; renders `PinyinText` under the word; TTS button uses `zh-CN`.
- **`/vocabulary/new` and `/vocabulary/[id]/edit`** — form branches on `language`:
  - `en` form (existing): `cefrLevel` select, dictionary auto-fill button visible.
  - `zh` form (new): `pinyin` Input (Vietnamese label "Pinyin (có dấu thanh)"), `hskLevel` Select (1–6), dictionary auto-fill button hidden, `cefrLevel` not rendered. `language` field is read-only on edit; create form auto-fills from `user.language` and shows it as a small badge in the form header.
- **`/vocabulary/study`** — branches per-entry; Chinese variant uses the same `ChineseFlashcardFront`/`ChineseFlashcardBack` composites as §3.5b.

### New custom composites (catalogued in §1.5)

- `LanguageGate` (used by `/choose-language`)
- `LanguageSwitcher` (used by TopNav)
- `HskBadge`, `ToneBadge`, `PinyinText`, `HanziText` (used across all Chinese variants)
- `ChineseFlashcardFront` / `ChineseFlashcardBack` (used by §3.5b and `/vocabulary/study`)

### Accessibility & i18n notes

- Hanzi content is wrapped in `lang="zh-CN"`; pinyin in `lang="zh-Latn-pinyin"`. Screen readers + automated translation tools handle these correctly without affecting the Vietnamese UI chrome (which stays unwrapped and inherits the root `lang="vi"`).
- Flag emojis are decorative; supplement with a `<span aria-label="Quốc kỳ Anh">`/`"Quốc kỳ Trung Quốc"` for screen-reader clarity.
- Color is never the sole signal for tones — pinyin always renders the tone diacritic AND optionally the colored ToneBadge. A user with color-vision-deficiency still reads the tones from the diacritics.
- TTS unavailable: speaker buttons disable + Tooltip ("Trình duyệt không hỗ trợ đọc tiếng Trung"); the flashcard remains usable without audio.

### Out of scope (Phase 2)

Stroke-order animation (HanziWriter), HSK 4–6 content, pre-recorded audio, Traditional Chinese, multi-language UI chrome (the Vietnamese UI labels stay Vietnamese in v6 — only the learning content changes).

### What does NOT change in v6

- All English flashcard / reading / vocabulary screens render exactly as before for English users — language is purely additive.
- All tokens, spacing, layout primitives are unchanged. The new tokens (`flashcard-hanzi`, `flashcard-pinyin`, tone colors, HSK palette) are additive.
- No existing endpoint contract breaks (see `api-contract.md` v6 DIFF).
- Vietnamese UI language is preserved — the spec only adds learning content variants, not chrome variants.
