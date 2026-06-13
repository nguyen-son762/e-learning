import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { parseBody } from "../middleware/validate";
import { toUser } from "../lib/serializers";

const languageSchema = z.object({
  language: z.enum(["en", "zh"]),
});

// PUT /api/users/me/language -> 200 { user: User }   (v6)
export async function setLanguage(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const { language } = parseBody(languageSchema, req.body);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { language },
  });
  if (!updated) {
    throw new AppError("UNAUTHENTICATED", "Token không hợp lệ hoặc đã hết hạn.");
  }

  res.status(200).json({ user: toUser(updated) });
}
