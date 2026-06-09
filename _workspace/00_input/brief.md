# Brief — English Learning Web App (MVP)

## Mục tiêu
Ứng dụng web học tiếng Anh, bản MVP gọn (không cần quá chi tiết).

## Tính năng cốt lõi
1. **Flashcard theo topic** — bộ thẻ từ vựng được nhóm theo topic; người dùng lật thẻ (front: từ, back: nghĩa/ví dụ); đánh dấu đã thuộc / chưa thuộc.
2. **Tiến độ học theo topic** — theo dõi % hoàn thành / số thẻ đã thuộc cho mỗi topic; dashboard tổng quan.
3. **Bài tập reading** — đoạn văn reading + câu hỏi trắc nghiệm; chấm điểm tự động; lưu kết quả.

## Xác thực
- Email + mật khẩu, JWT. Đăng ký / đăng nhập tự quản lý.

## Stack (baseline harness)
- Frontend: Next.js (App Router) + Tailwind + shadcn/ui
- Backend: Express + Postgres + Prisma
- Deploy: Vercel

## Phạm vi loại trừ (MVP)
- Không có course catalog / video lesson player phức tạp.
- Không spaced-repetition nâng cao (chỉ cần mark thuộc/chưa thuộc + reset ôn lại).
- Không OAuth, không social features.

## Đối tượng & ngôn ngữ UI
- UI tiếng Việt (người học Việt học tiếng Anh). Nội dung học bằng tiếng Anh.
