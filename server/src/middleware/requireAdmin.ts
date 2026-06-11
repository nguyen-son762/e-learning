import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.userRole !== "ADMIN") {
    next(new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này."));
    return;
  }
  next();
}
