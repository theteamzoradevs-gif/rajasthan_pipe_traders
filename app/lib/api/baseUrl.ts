/**
 * Optional origin for resolving relative media URLs from another host (e.g. CDN).
 * Catalog HTTP lives on this app (`/api/categories`, `/api/products`); leave unset for same-origin assets.
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "") ?? "";
}

/**
 * Image paths from the API are often site-relative (e.g. `/Cable_Clip.png`).
 * Those map to this app's `public/` folder — do not prefix an external base,
 * or `next/image` would request the file from the wrong host.
 */
export function resolveAssetUrl(path: string | undefined, baseUrl?: string): string {
  if (!path) return "/Cable_Clip.png";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) return path;
  const base = (baseUrl ?? getApiBaseUrl()).replace(/\/$/, "");
  const segment = path.replace(/^\/+/, "");
  if (!base) return `/${segment}`;
  return `${base}/${segment}`;
}
