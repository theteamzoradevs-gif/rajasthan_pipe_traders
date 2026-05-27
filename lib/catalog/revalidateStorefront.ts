import { revalidatePath } from "next/cache";

/** Bust ISR/HTML cache for catalog pages after admin price changes. */
export function revalidateStorefrontAfterPriceChange() {
  revalidatePath("/", "layout");
  revalidatePath("/category", "layout");
  revalidatePath("/categories", "layout");
  revalidatePath("/products", "layout");
}
