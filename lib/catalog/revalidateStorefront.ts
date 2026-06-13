import { revalidatePath } from "next/cache";

/** Bust ISR/HTML cache for catalog pages after admin price changes. */
export function revalidateStorefrontAfterPriceChange() {
  revalidatePath("/", "layout");
  revalidatePath("/category", "layout");
  revalidatePath("/categories", "layout");
  revalidatePath("/products", "layout");
}

/** Revalidate specific category pages after bulk product import. */
export function revalidateStorefrontCategorySlugs(slugs: string[]) {
  for (const slug of slugs) {
    const trimmed = slug.trim().toLowerCase();
    if (trimmed) revalidatePath(`/category/${trimmed}`);
  }
}
