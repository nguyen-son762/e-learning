"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

type Status<T> =
  | { phase: "loading"; data: null; error: null }
  | { phase: "success"; data: T; error: null }
  | { phase: "error"; data: null; error: ApiError };

const LOADING: Status<never> = { phase: "loading", data: null, error: null };

/**
 * Minimal fetch-on-mount query hook. `fetcher` MUST return data typed to the
 * contract's response shape (including any { items, total } wrapper).
 * `depsKey` is a stable string (e.g. a route [slug]); changing it re-runs.
 */
export function useQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  depsKey: string,
): QueryState<T> {
  const [state, setState] = useState<Status<T>>(LOADING);
  const [nonce, setNonce] = useState(0);

  // The fetcher closes over depsKey/nonce-relevant values; we read the latest
  // from a ref so it need not be an effect dependency. Written inside the
  // effect (never during render).
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
    const ctrl = new AbortController();
    let active = true;

    // Reset to loading for re-runs (keyed by depsKey/nonce).
    setState((prev) => (prev.phase === "loading" ? prev : LOADING));

    fetcherRef.current(ctrl.signal).then(
      (res) => {
        if (active) setState({ phase: "success", data: res, error: null });
      },
      (err: unknown) => {
        if (!active) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        const apiErr =
          err instanceof ApiError
            ? err
            : new ApiError("INTERNAL_ERROR", "Đã xảy ra lỗi.", 0);
        setState({ phase: "error", data: null, error: apiErr });
      },
    );

    return () => {
      active = false;
      ctrl.abort();
    };
    // fetcher read via ref; effect intentionally keyed by depsKey + nonce only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: state.data,
    loading: state.phase === "loading",
    error: state.error,
    refetch,
  };
}
