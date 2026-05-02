import type { CartItem } from "@/app/context/CartWishlistContext";
import { normalizeOrderMode, type CartOrderMode } from "@/lib/cart/packetLine";

const DEFAULT_SID = "default";

export function normalizeSellerId(sid: string | undefined): string {
  return sid && sid.length > 0 ? sid : DEFAULT_SID;
}

export function cartLineMatches(
  ci: CartItem,
  productId: number,
  size: string,
  sellerId: string | undefined,
  mode: CartOrderMode
): boolean {
  const sid = normalizeSellerId(sellerId);
  return (
    ci.productId === productId &&
    ci.size === size &&
    normalizeSellerId(ci.sellerId) === sid &&
    normalizeOrderMode(ci.orderMode) === mode
  );
}
