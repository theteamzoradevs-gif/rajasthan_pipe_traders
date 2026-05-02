import type { Product } from "@/app/data/products";
import type { ApiProduct } from "@/app/lib/api/types";

type ApiProductWithSort = ApiProduct & { sortOrder?: number; categorySortOrder?: number };

const ranked = (n: unknown) => typeof n === "number" && n > 0;

/**
 * Admin sort order is 1-based: `0` (or missing) means “no position”.
 * Ranked items (`sortOrder` > 0) sort first by that number; ties use name.
 * Unranked items stay **in original list order** (no reordering / “swapping” among zeros).
 */
export function sortApiProductsForDisplayOrder(products: ApiProduct[]): ApiProduct[] {
  return products
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const itemA = a.item as ApiProductWithSort;
      const itemB = b.item as ApiProductWithSort;
      // Prioritize category-specific order, fall back to global sortOrder
      const ar = ranked(itemA.categorySortOrder) ? itemA.categorySortOrder : itemA.sortOrder;
      const br = ranked(itemB.categorySortOrder) ? itemB.categorySortOrder : itemB.sortOrder;

      const ae = ranked(ar) ? ar! : Number.POSITIVE_INFINITY;
      const be = ranked(br) ? br! : Number.POSITIVE_INFINITY;
      if (ae !== be) return ae - be;
      if (ae === Number.POSITIVE_INFINITY) {
        return a.index - b.index;
      }
      return a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" });
    })
    .map(({ item }) => item);
}

/**
 * Home listing sort: use only global `sortOrder` (ignore `categorySortOrder`).
 * Ranked items (`sortOrder` > 0) come first; ties use name.
 * Unranked items keep original input order.
 */
export function sortApiProductsForHomeOrder(products: ApiProduct[]): ApiProduct[] {
  return products
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const itemA = a.item as ApiProductWithSort;
      const itemB = b.item as ApiProductWithSort;
      const ar = itemA.sortOrder;
      const br = itemB.sortOrder;

      const ae = ranked(ar) ? ar! : Number.POSITIVE_INFINITY;
      const be = ranked(br) ? br! : Number.POSITIVE_INFINITY;
      if (ae !== be) return ae - be;
      if (ae === Number.POSITIVE_INFINITY) {
        return a.index - b.index;
      }
      return a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" });
    })
    .map(({ item }) => item);
}

/** Same rules as {@link sortApiProductsForDisplayOrder} for mapped `Product` rows. */
export function sortProductsForDisplayOrder(products: Product[]): Product[] {
  return products
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const valA = ranked(a.item.categorySortOrder) ? a.item.categorySortOrder : a.item.sortOrder;
      const valB = ranked(b.item.categorySortOrder) ? b.item.categorySortOrder : b.item.sortOrder;

      const ae = ranked(valA) ? valA! : Number.POSITIVE_INFINITY;
      const be = ranked(valB) ? valB! : Number.POSITIVE_INFINITY;
      if (ae !== be) return ae - be;
      if (ae === Number.POSITIVE_INFINITY) {
        return a.index - b.index;
      }
      return a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" });
    })
    .map(({ item }) => item);
}
