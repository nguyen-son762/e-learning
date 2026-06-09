/**
 * Typed fetch wrapper. Attaches Bearer token, parses the uniform error shape
 * `{ error: { code, message } }` from api-contract.md, and returns the parsed
 * JSON typed to T. T MUST equal the contract's response shape, INCLUDING the
 * { items, total } wrapper for list endpoints — never type a list as a bare array.
 */
import { getToken } from "@/lib/auth";
import type { ApiErrorShape } from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Set false for unauthenticated endpoints (register/login). */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function fetchJson<T>(
  path: string,
  opts: FetchOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true, signal } = opts;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Không kết nối được máy chủ. Vui lòng thử lại.",
      0,
    );
  }

  // 204 / empty body
  if (res.status === 204) {
    return undefined as T;
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errData = data as ApiErrorShape | null;
    const code = errData?.error?.code ?? "INTERNAL_ERROR";
    const message =
      errData?.error?.message ?? "Đã xảy ra lỗi. Vui lòng thử lại.";
    throw new ApiError(code, message, res.status);
  }

  return data as T;
}

export { API_BASE_URL };
