/** For display headings: "20MM" / "20mm" → "20 MM" */
export function formatSizeForHeading(size: string): string {
  return size.replace(/(\d)(MM)\b/gi, (_, digit: string) => `${digit} MM`);
}

/**
 * e.g. "Double Nail Clamps" + "20MM" → "Double Nail Clamps 20 MM".
 * Omits the size suffix when it is empty or the placeholder "Standard" (single default row from catalog).
 */
export function productHeading(name: string, size: string): string {
  const n = String(name ?? "").trim();
  const s = String(size ?? "").trim();
  if (!s || s.toLowerCase() === "standard") return n;
  return `${n} ${formatSizeForHeading(s)}`.trim();
}

/** Which color variant to use for the brand pill (keyword-based). */
export type BrandPillVariant = "hitech" | "tejas" | "nstar" | "default";

export function resolveBrandPillVariant(brand: string | undefined): BrandPillVariant {
  if (!brand?.trim()) return "default";
  const n = brand.trim().toLowerCase();
  if (n.includes("tejas")) return "tejas";
  if (n.includes("n-star") || n === "nstar") return "nstar";
  if (n.includes("hitech") || n.includes("hi-tech")) return "hitech";
  return "default";
}

/** Trimmed text for the pill, or "" when the tag should be hidden. */
export function brandPillLabel(brand: string | undefined): string {
  if (!brand?.trim()) return "";
  return brand.trim();
}
