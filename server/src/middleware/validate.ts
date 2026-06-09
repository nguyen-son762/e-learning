import { ZodError, type ZodSchema } from "zod";
import { AppError } from "../lib/errors";

// Parse + validate with zod, converting ZodError into the contract's VALIDATION_ERROR.
export function parseBody<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.errors[0];
      const path = first?.path?.join(".");
      const message = first
        ? `Dữ liệu không hợp lệ${path ? ` (${path})` : ""}: ${first.message}`
        : "Dữ liệu không hợp lệ.";
      throw new AppError("VALIDATION_ERROR", message);
    }
    throw err;
  }
}
