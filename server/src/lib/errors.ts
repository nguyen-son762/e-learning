// Uniform application error → maps to the contract's { error: { code, message } } shape.

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "LANGUAGE_NOT_SELECTED"
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "TOPIC_NAME_CONFLICT"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  LANGUAGE_NOT_SELECTED: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  TOPIC_NAME_CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

// v8 — optional machine-readable details on a VALIDATION_ERROR (e.g. `field: "vocabularyTopicId"`).
export interface AppErrorDetails {
  field?: string;
}

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: AppErrorDetails;

  constructor(code: ErrorCode, message: string, details?: AppErrorDetails) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    if (details) this.details = details;
  }
}
