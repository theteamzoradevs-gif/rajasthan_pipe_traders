const DEFAULT_TIMEOUT_MS = 25_000;

type FetchWithTimeoutOptions = RequestInit & { timeoutMs?: number };

/**
 * `fetch` with an AbortController deadline so client-side catalog calls
 * do not hang until the tab/browser gives up.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  { timeoutMs = DEFAULT_TIMEOUT_MS, signal: outerSignal, ...init }: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const onOuterAbort = () => controller.abort();
  if (outerSignal) {
    if (outerSignal.aborted) {
      clearTimeout(t);
      throw new DOMException("Aborted", "AbortError");
    }
    outerSignal.addEventListener("abort", onOuterAbort, { once: true });
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
    if (outerSignal) {
      outerSignal.removeEventListener("abort", onOuterAbort);
    }
  }
}
