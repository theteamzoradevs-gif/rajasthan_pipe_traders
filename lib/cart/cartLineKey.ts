import { normalizeOrderMode, type CartOrderMode } from "@/lib/cart/packetLine";

const DEFAULT_SELLER = "default";

function normalizeSellerId(sellerId: string | undefined): string {
  return sellerId && sellerId.length > 0 ? sellerId : DEFAULT_SELLER;
}

export type CartLineKeyInput = {
  productId: number;
  mongoProductId?: string;
  size: string;
  sellerId: string;
  orderMode?: CartOrderMode;
};

/** Must match `lineKey` in `lib/combo/resolveCartComboPricing.ts` for API merge. */
export function comboCartLineKeyFromCartItem(item: CartLineKeyInput): string {
  const mode = normalizeOrderMode(item.orderMode);
  const id = item.mongoProductId ?? `legacy:${item.productId}`;
  return `${id}|${item.size}|${normalizeSellerId(item.sellerId)}|${mode}`;
}
