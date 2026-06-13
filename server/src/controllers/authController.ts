import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { signToken } from "../lib/jwt";
import { parseBody } from "../middleware/validate";
import { toUser } from "../lib/serializers";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().trim().min(1).max(80),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register -> 201 { token, user }
// v7 — register-time user has no earned badges (gamification state starts empty).
export async function register(req: Request, res: Response): Promise<void> {
  const body = parseBody(registerSchema, req.body);
  const email = body.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("EMAIL_TAKEN", "Email này đã được sử dụng.");
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: body.name },
  });

  const token = signToken(user.id);
  res.status(201).json({ token, user: toUser(user, []) });
}

// POST /api/auth/login -> 200 { token, user }
// v7 — include the user's persisted earned-badge log on the response.
export async function login(req: Request, res: Response): Promise<void> {
  const body = parseBody(loginSchema, req.body);
  const email = body.email.toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.");
  }

  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) {
    throw new AppError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.");
  }

  const badges = await prisma.earnedBadge.findMany({
    where: { userId: user.id },
    orderBy: { earnedAt: "asc" },
  });

  const token = signToken(user.id);
  res.status(200).json({ token, user: toUser(user, badges) });
}

// GET /api/auth/me -> 200 { user }
// v7 — wraps streak/totalXP/lastStudiedAt + the user's persisted badge log into the User shape.
export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    throw new AppError("UNAUTHENTICATED", "Token không hợp lệ hoặc đã hết hạn.");
  }
  const badges = await prisma.earnedBadge.findMany({
    where: { userId: user.id },
    orderBy: { earnedAt: "asc" },
  });
  res.status(200).json({ user: toUser(user, badges) });
}
