# Feature: Tích hợp Học Tiếng Trung (Chinese Learning Module)

**Ngày yêu cầu:** 2026-06-13
**Loại:** New feature spanning UI + API (multi-language extension)
**Mode:** Partial rebuild — extend existing `_workspace/` artifacts (contract v5 → v6)

---

## Mục tiêu

App hiện chỉ hỗ trợ học tiếng Anh. Cần tích hợp **học tiếng Trung** song song, giữ toàn bộ feature hiện có (topics, flashcards, SRS, reading, vocabulary, admin) hoạt động cho cả 2 ngôn ngữ. Sau login, user chọn ngôn ngữ học (Anh/Trung) và có thể switch bất cứ lúc nào.

## User flow

```
Login → nếu user.language == null → /choose-language (chọn 1 trong 2)
                                  → lưu, redirect /dashboard
        nếu đã chọn rồi → /dashboard (filter theo language hiện tại)
TopNav có nút switch ngôn ngữ → đổi User.language → reload data
```

## Yêu cầu chi tiết

### 1. Language Gate
- Trang `/choose-language` — 2 card lớn: "Học Tiếng Anh 🇬🇧" / "Học Tiếng Trung 🇨🇳"
- Lưu vào `User.language: "en" | "zh"` (default `null` → buộc chọn)
- TopNav: hiển thị ngôn ngữ hiện tại + dropdown switch

### 2. DB / Contract
- Thêm `language: "en" | "zh"` vào: `User`, `Topic`, `ReadingExercise`, `VocabularyEntry`
- `Flashcard` kế thừa `language` từ `Topic` (KHÔNG thêm trường vào Flashcard)
- `VocabularyEntry`: thêm `pinyin: string?`, `hskLevel: int?` (1–6). `cefrLevel` vẫn giữ (chỉ dùng khi `language == "en"`)
- Mọi list endpoint thêm `?language=en|zh` filter. Default = user's current `language`.

### 3. API thêm/sửa
- `GET /api/auth/me` → trả thêm `user.language`
- `PUT /api/users/me/language { language: "en" | "zh" }` → cập nhật & trả `User`
- `GET /api/topics`, `GET /api/reading-exercises`, `GET /api/vocabulary` → support `?language=` query
- `POST /api/topics` → body thêm `language` (admin-seed) / nếu user-created thì dùng `language` của user
- `POST /api/reading-exercises` (admin) → body thêm `language`
- `POST /api/vocabulary` → body thêm `pinyin?`, `hskLevel?`, `language` (auto = user.language)

### 4. Frontend tiếng Trung
- Flashcard tiếng Trung:
  - Mặt trước: Hán tự cỡ lớn (font-size ~64px), badge thanh điệu (1-4 + nhẹ) nếu có
  - Mặt sau: Pinyin (với dấu thanh) + nghĩa tiếng Việt + ví dụ song ngữ (Hán + pinyin + Việt)
- TTS: dùng Web Speech API `lang="zh-CN"` (mở rộng `src/lib/tts.ts`)
- Vocabulary form tiếng Trung: input pinyin (auto-suggest từ Hán tự nếu có thể), select HSK 1–6 thay cho CEFR

### 5. Content seeding (HSK 1–3)
- HSK 1 (~150 từ): số đếm, màu sắc, gia đình, chào hỏi, đại từ — 5 topic
- HSK 2 (~300 từ): hành động, thời gian, địa điểm, đồ ăn — 5 topic
- HSK 3 (~600 từ): cảm xúc, thời tiết, mua sắm — 3 topic (mỗi topic ~20 từ là đủ cho MVP)
- Mỗi topic gắn `language: "zh"`, flashcard có `front` = Hán tự, `back` = "pinyin — nghĩa tiếng Việt", `example` = câu Hán + pinyin
- Thêm 2-3 reading exercise HSK 2-3 (đoạn văn ngắn 100-200 ký tự)

### 6. Constraints
- Backward-compatible: tất cả user/content hiện tại default `language: "en"`
- Migration: backfill `language = "en"` cho tất cả rows hiện có
- `User.language` nullable → cho phép buộc chọn lần đầu (sau login nếu null → redirect)
- KHÔNG breaking change cho frontend hiện tại — chỉ additive

## Out of scope (Phase 2)
- Stroke order animation (HanziWriter)
- HSK 4-6 content
- Audio file pre-recorded (chỉ dùng Web Speech TTS)
- Traditional Chinese (chỉ simplified)
- Multi-language UI (UI vẫn tiếng Việt)

## Acceptance criteria
- [ ] User mới đăng ký → buộc qua `/choose-language` trước khi vào dashboard
- [ ] User chọn tiếng Trung → dashboard chỉ hiện topics/readings/vocab tiếng Trung
- [ ] Switch sang tiếng Anh → dashboard chỉ hiện content tiếng Anh
- [ ] HSK 1-3 content được seed sẵn (≥ 13 topics, ≥ 200 flashcards)
- [ ] Flashcard tiếng Trung: Hán tự lớn, pinyin có dấu, TTS đọc được zh-CN
- [ ] Admin tạo reading exercise có thể chọn ngôn ngữ
- [ ] User cũ (đã đăng ký) auto được set `language = "en"` (backward compat)
