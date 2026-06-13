/** Storefront-safe slug from a display name (lowercase, hyphen-separated). */
export function slugFromName(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
