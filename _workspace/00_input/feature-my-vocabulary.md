# Feature brief — "Từ vựng của tôi" (My Vocabulary)

Personal vocabulary store, mỗi user tự lưu/quản lý từ vựng riêng.

## Fields (per entry)
- word (string, required) — từ tiếng Anh
- meaning (string, required) — ý nghĩa (tiếng Việt hoặc Anh)
- pronunciation (string, optional) — phát âm IPA
- partOfSpeech (string, optional) — loại từ (noun/verb/adj/adv/...)
- synonyms (string[], optional) — từ đồng nghĩa
- antonyms (string[], optional) — từ trái nghĩa
- exampleSentence (string, optional) — câu ví dụ chứa từ
- notes (string, optional) — ghi chú cá nhân
- tags (string[], optional) — nhóm chủ đề tự đặt
- cefrLevel (string, optional) — A1/A2/B1/B2/C1/C2
- isFavorite (boolean) — đánh dấu sao
- known (boolean) — trạng thái thuộc (cho chế độ học flashcard)

## Features
1. **CRUD** đầy đủ: thêm / sửa / xoá / xem danh sách từ vựng cá nhân.
2. **Tự điền từ điển (frontend-only)**: gõ word → gọi https://api.dictionaryapi.dev/api/v2/entries/en/<word> (free, no key, CORS OK) → auto-fill meaning/pronunciation/partOfSpeech/synonyms/example. User chỉnh lại trước khi lưu. KHÔNG đi qua backend.
3. **Phát âm TTS (frontend-only)**: nút loa đọc từ bằng Web SpeechSynthesis. Không cần backend.
4. **Học như flashcard**: tái dùng UX flashcard hiện có để ôn bộ từ cá nhân (front=word, back=meaning+example), mark thuộc/chưa thuộc, auto-advance.
5. **Tìm kiếm / lọc / yêu thích**: search theo word/meaning; lọc theo tag, partOfSpeech, favorite; sort mới nhất.

## Ràng buộc
- Mọi entry thuộc về user đang đăng nhập (auth bắt buộc), không xem được của người khác.
- Theo contract chuẩn: camelCase, list wrapper { items, total }, error { error: { code, message } }.
- Tích hợp vào app hiện có (TopNav thêm mục "Từ vựng của tôi").
