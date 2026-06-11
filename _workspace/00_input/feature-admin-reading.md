# Feature: Admin Reading Management

## Mô tả
Cho phép tài khoản ADMIN tạo, sửa, xóa bài đọc (ReadingExercise) và câu hỏi trắc nghiệm (ReadingQuestion).
Người học thường (USER) chỉ được đọc bài và nộp bài như hiện tại.

## Thay đổi Data Model
- Thêm enum `Role { USER ADMIN }` vào Prisma schema
- Thêm field `role Role @default(USER)` vào model `User`
- Tạo Prisma migration

## API Endpoints mới (yêu cầu role = ADMIN)
- POST   /api/reading-exercises                         — tạo bài đọc mới + questions
- PUT    /api/reading-exercises/:slug                   — sửa bài đọc
- DELETE /api/reading-exercises/:slug                   — xóa bài đọc (cascade)
- POST   /api/reading-exercises/:slug/questions         — thêm câu hỏi
- PUT    /api/reading-exercises/:slug/questions/:id     — sửa câu hỏi
- DELETE /api/reading-exercises/:slug/questions/:id     — xóa câu hỏi

## Middleware mới
- `requireAdmin`: kiểm tra `req.user.role === 'ADMIN'`, nếu không → 403 FORBIDDEN

## Frontend Routes mới (trong (app) shell)
- /admin/reading               — danh sách bài đọc + Edit/Delete/Tạo mới
- /admin/reading/new           — form tạo bài đọc mới
- /admin/reading/[slug]/edit   — form sửa bài đọc

## Seed Admin
- admin@elearning.com / Admin@123 với role ADMIN (trong prisma/seed.ts)

## Constraint
- Existing reading endpoints/pages KHÔNG bị thay đổi
- SRS feature KHÔNG bị thay đổi
- Non-admin gọi admin endpoints → 403
- Non-admin truy cập /admin/* → redirect /dashboard
