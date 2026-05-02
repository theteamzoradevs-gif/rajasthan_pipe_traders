import { fetchWithTimeout } from "@/lib/http/fetchWithTimeout";
import type {
  ApiCategoriesResponse,
  ApiErrorBody,
  ApiProductsListResponse,
} from "./types";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error(res.ok ? "Empty response" : `Request failed (${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid JSON from API");
  }
}

export async function fetchCategoriesList(init?: RequestInit): Promise<ApiCategoriesResponse> {
  const res = await fetchWithTimeout("/api/categories", {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", ...init?.headers },
  });
  const body = await readJson<ApiCategoriesResponse & ApiErrorBody>(res);
  if (!res.ok) {
    const msg = body.details ?? body.message ?? `Categories request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

export async function fetchProductsList(
  searchParams: Record<string, string | number | undefined>,
  init?: RequestInit
): Promise<ApiProductsListResponse> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v === undefined || v === "") continue;
    q.set(k, String(v));
  }
  const res = await fetchWithTimeout(`/api/products?${q.toString()}`, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", ...init?.headers },
  });
  const body = await readJson<ApiProductsListResponse & ApiErrorBody>(res);
  if (!res.ok) {
    const msg = body.details ?? body.message ?? `Products request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}
