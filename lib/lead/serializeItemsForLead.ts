import type { CartItem } from "@/app/context/CartWishlistContext";

export type LeadCartItemSnapshot = {
  productId: number;
  size: string;
  productName: string;
  quantity: number;
  orderMode: string;
};

export function serializeItemsForLead(items: CartItem[]): LeadCartItemSnapshot[] {
  return items.map((i) => ({
    productId: i.productId,
    size: i.size,
    productName: i.productName,
    quantity: i.quantity,
    orderMode: i.orderMode ?? "packets",
  }));
}
