import type { ProductListingEntry } from "../data/products";

/** Prefer product-level brand (Mongo/admin), then seller offer brand. */
export function displayBrandForListingEntry(entry: ProductListingEntry): string {
  const b = entry.product.brand || entry.offer.brand || "";
  return typeof b === "string" ? b.trim() : "";
}

/**
 * Sidebar groups — labels match DB-style names. Matching is substring, case-insensitive
 * (e.g. "Tejas" matches "Tejas Craft", "hitech" matches "Hitech Square").
 */
export const BRAND_SIDEBAR_FILTERS = [
  {
    id: "hitech",
    label: "Hitech Square",
    matches: (brand: string) => {
      const n = brand.toLowerCase();
      return n.includes("hitech") || n.includes("hi-tech");
    },
  },
  {
    id: "tejas",
    label: "Tejas Craft",
    matches: (brand: string) => {
      const n = brand.toLowerCase();
      return n.includes("tejas");
    },
  },
] as const;

export type BrandSidebarFilterId = (typeof BRAND_SIDEBAR_FILTERS)[number]["id"];

export function entryMatchesSelectedBrandFilters(
  entry: ProductListingEntry,
  selectedIds: ReadonlySet<string>
): boolean {
  if (selectedIds.size === 0) return true;
  const brand = displayBrandForListingEntry(entry);
  for (const id of selectedIds) {
    const def = BRAND_SIDEBAR_FILTERS.find((f) => f.id === id);
    if (def?.matches(brand)) return true;
  }
  return false;
}

export function filterLabelForId(id: string): string {
  return BRAND_SIDEBAR_FILTERS.find((f) => f.id === id)?.label ?? id;
}
