import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";

// Terminal error middleware — always emits the contract's { error: { code, message } } shape.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const payload: { code: string; message: string; field?: string } = {
      code: err.code,
      message: err.message,
    };
    // v8 — surface machine-readable `field` on VALIDATION_ERROR when supplied
    // (e.g. POST/PUT /api/vocabulary with bad vocabularyTopicId).
    if (err.details?.field) payload.field = err.details.field;
    res.status(err.status).json({ error: payload });
    return;
  }

  // Malformed JSON body (express.json throws a SyntaxError).
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Body JSON không hợp lệ." },
    });
    return;
  }

  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Đã xảy ra lỗi không mong muốn." },
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Không tìm thấy tài nguyên." },
  });
}
