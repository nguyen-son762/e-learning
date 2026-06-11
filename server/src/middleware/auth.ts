import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";

// Augment Express Request with the authed user id.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.header("authorization") ?? req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError("UNAUTHENTICATED", "Token không hợp lệ hoặc đã hết hạn.");
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new AppError("UNAUTHENTICATED", "Token không hợp lệ hoặc đã hết hạn.");
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError("UNAUTHENTICATED", "Token không hợp lệ hoặc đã hết hạn.");
    }

    // Ensure the user still exists.
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new AppError("UNAUTHENTICATED", "Token không hợp lệ hoặc đã hết hạn.");
    }

    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch (err) {
    next(err);
  }
}
