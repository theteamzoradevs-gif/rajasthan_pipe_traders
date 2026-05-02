/** Header / storefront typeahead: one row per catalog hit (from GET /api/products). */
export interface SearchEntry {
  name: string;
  slug: string;
  category: string;
  brand: string;
}
