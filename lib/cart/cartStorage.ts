import type { CartItem } from "@/app/context/CartWishlistContext";
import type { CartOrderMode } from "@/lib/cart/packetLine";

const CART_STORAGE_KEY = "rpt_cart_v1";

const DEFAULT_SELLER_ID = "default";

function normalizeSellerId(sellerId: string | undefined): string {
  return sellerId && sellerId.length > 0 ? sellerId : DEFAULT_SELLER_ID;
}

function normalizeOrderMode(mode: unknown): CartOrderMode {
  return mode === "master_bag" ? "master_bag" : "packets";
}

/** Restore cart from localStorage with loose validation (survives schema tweaks). */
export function loadCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: CartItem[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const productId = Number(r.productId);
      const quantity = Number(r.quantity);
      if (!Number.isFinite(productId) || !Number.isFinite(quantity) || quantity < 1) continue;
      const size = String(r.size ?? "").trim();
      if (!size) continue;
      out.push({
        productId,
        mongoProductId: typeof r.mongoProductId === "string" ? r.mongoProductId : undefined,
        categoryMongoId: typeof r.categoryMongoId === "string" ? r.categoryMongoId : undefined,
        productSlug: String(r.productSlug ?? ""),
        productImage: String(r.productImage ?? ""),
        productName: String(r.productName ?? ""),
        brand: String(r.brand ?? ""),
        category: String(r.category ?? ""),
        sellerId: normalizeSellerId(typeof r.sellerId === "string" ? r.sellerId : undefined),
        sellerName: String(r.sellerName ?? ""),
        size,
        quantity,
        pricePerUnit: Number(r.pricePerUnit) || 0,
        basicPricePerUnit: Number(r.basicPricePerUnit) || 0,
        qtyPerBag: Number(r.qtyPerBag) || 0,
        pcsPerPacket: Math.max(1, Number(r.pcsPerPacket) || 1),
        orderMode: normalizeOrderMode(r.orderMode),
        comboPricedPackets:
          typeof r.comboPricedPackets === "number" && Number.isFinite(r.comboPricedPackets)
            ? Math.max(0, r.comboPricedPackets)
            : undefined,
        comboSubtotalInclGst:
          typeof r.comboSubtotalInclGst === "number" && Number.isFinite(r.comboSubtotalInclGst)
            ? Math.max(0, r.comboSubtotalInclGst)
            : undefined,
        isComboApplied: typeof r.isComboApplied === "boolean" ? r.isComboApplied : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function saveCartToStorage(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota / private mode */
  }
}

export function clearCartStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
