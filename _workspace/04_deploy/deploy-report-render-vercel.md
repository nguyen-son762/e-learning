# Deploy Report — FE (Vercel) + BE (Render)

**Date:** 2026-06-13
**Strategy:** Split deployment — Next.js frontend on Vercel, Express + Prisma backend on Render

---

## Status: READY-TO-RUN

Build CI đã PASS (v6). Tất cả config files đã sẵn sàng. Chỉ cần điền env vars thật và chạy các bước bên dưới.

---

## Kiến trúc

```
Browser → Vercel (Next.js)  →  Render (Express API)  →  Postgres (Render/Supabase)
```

---

## 1. Deploy Backend lên Render

### Bước 1 — Tạo Postgres database trên Render
1. Vào [render.com](https://render.com) → New → PostgreSQL
2. Đặt tên: `elearning-db`
3. Sau khi tạo, copy **Internal Database URL** và **External Database URL**

### Bước 2 — Tạo Web Service trên Render
1. New → Web Service → Connect GitHub repo `nguyen-son762/e-learning`
2. Cấu hình:
   - **Root Directory:** `server`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm run start:prod`
   - **Node version:** 20

### Bước 3 — Set Environment Variables trên Render

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Internal Database URL + `?pgbouncer=true&sslmode=require` (nếu dùng Supabase) hoặc Internal URL từ Render Postgres |
| `DIRECT_URL` | External Database URL (dùng cho migrate) |
| `JWT_SECRET` | Random string dài (chạy: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | URL Vercel frontend, ví dụ: `https://elearning-sonnt.vercel.app` |
| `NODE_ENV` | `production` |
| `PORT` | `4000` |

> `start:prod` đã chạy `prisma migrate deploy` tự động trước khi start — không cần migrate thủ công.

### Bước 4 — Lấy Render API URL
Sau khi deploy xong, Render cấp URL dạng: `https://elearning-api.onrender.com`

---

## 2. Deploy Frontend lên Vercel

### Bước 1 — Import project
1. Vào [vercel.com](https://vercel.com) → New Project → Import `nguyen-son762/e-learning`
2. Framework tự detect: **Next.js** ✓
3. Root Directory: để trống (root của repo)

### Bước 2 — Set Environment Variables trên Vercel

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_BASE_URL` | URL Render backend, ví dụ: `https://elearning-api.onrender.com` |

> **Quan trọng:** `NEXT_PUBLIC_*` được bake-in lúc build. Nếu đổi URL Render → phải redeploy Vercel.

### Bước 3 — Deploy
Click **Deploy** — Vercel tự build từ `main` branch.

---

## 3. Checklist cuối

- [ ] Render Postgres tạo xong, có Internal URL
- [ ] Render Web Service: env vars đã set đủ 7 keys
- [ ] Render deploy thành công, API URL có dạng `https://elearning-api.onrender.com`
- [ ] Vercel: `NEXT_PUBLIC_API_BASE_URL` = Render API URL (không có trailing slash)
- [ ] Vercel: `CORS_ORIGIN` trên Render = Vercel frontend URL
- [ ] Test: `GET https://elearning-api.onrender.com/health` trả về 200
- [ ] Test: Login flow trên Vercel frontend hoạt động

---

## Files đã tạo/cập nhật

| File | Mục đích |
|------|----------|
| `render.yaml` | Render deployment config (auto-detect từ repo root) |
| `vercel.json` | Vercel build config (đã có sẵn, không thay đổi) |
| `server/.env.example` | Template env vars cho backend |
| `.env.example` | Template env vars cho frontend |
| `server/package.json` → `start:prod` | Chạy migrate + start trong một lệnh |
