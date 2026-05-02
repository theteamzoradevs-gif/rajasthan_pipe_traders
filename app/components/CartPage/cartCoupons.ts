import type { CartItem } from "../../context/CartWishlistContext";
import { normalizeOrderMode, pricedPacketCount } from "@/lib/cart/packetLine";
import {
  computeCouponTierPacketCount,
  type ProductPackagingForCoupon,
} from "@/lib/coupons/couponTierQuantity";

/** Shape returned by GET /api/coupons (see `toPublicCouponBanner` in lib/coupons/evaluate.ts) */
export type PublicCouponBannerJson = {
  code: string;
  discount?: unknown;
  label?: unknown;
  condition?: unknown;
  desc?: unknown;
  theme?: unknown;
  /** Tier thresholds: packets vs outer cartons/bags */
  tierUnit?: unknown;
};

export type CartCouponOption = {
  code: string;
  /** Left stub primary (e.g. Up to 12%) */
  discount: string;
  /** Left stub secondary (e.g. OFF) */
  label: string;
  /** Title line (coupon name) */
  condition: string;
  desc: string;
  /** Accent for card strip (theme) */
  color: string;
  /** Matches DB `Coupon.tierUnit` — used to pick auto-apply family */
  tierUnit: "packets" | "outer";
};

export const COUPON_THEME_HEX: Record<string, string> = {
  blue: "#2563eb",
  indigo: "#4f46e5",
  green: "#059669",
  amber: "#d97706",
  brown: "#92400e",
};

export function mapPublicCouponToOption(c: PublicCouponBannerJson): CartCouponOption {
  const theme = typeof c.theme === "string" ? c.theme : "blue";
  const color = COUPON_THEME_HEX[theme] ?? COUPON_THEME_HEX.blue;
  const tierUnit = c.tierUnit === "outer" ? "outer" : "packets";
  return {
    code: String(c.code ?? "").trim(),
    discount: String(c.discount ?? ""),
    label: typeof c.label === "string" ? c.label : "",
    condition: String(c.condition ?? ""),
    desc: typeof c.desc === "string" ? c.desc : "",
    color,
    tierUnit,
  };
}

/** Mongo `pricingUnit` values where the line is sold by carton/box/bag (not by packet). */
const OUTER_PRICING_UNITS = new Set([
  "per_cartoon",
  "per_box",
  "per_bag",
  "per_master_bag",
]);

/**
 * When true, auto-apply should only compete among `tierUnit === "outer"` coupons so carton/bag
 * lines do not lose to packet-tier coupons that unlock on huge derived packet counts.
 */
export function cartPrefersOuterTierCoupons(
  items: CartItem[],
  packagingPerLine: (ProductPackagingForCoupon | null)[] | null | undefined
): boolean {
  if (!items.length) return false;
  for (let i = 0; i < items.length; i++) {
    if (normalizeOrderMode(items[i].orderMode) === "master_bag") {
      return true;
    }
    const pkg = packagingPerLine?.[i];
    if (!pkg) continue;
    const pu = String(pkg.pricingUnit ?? "per_packet").trim().toLowerCase();
    if (OUTER_PRICING_UNITS.has(pu)) {
      return true;
    }
  }
  return false;
}

/**
 * Coupons to consider for auto-apply: outer-only vs packet-only when the cart clearly matches one
 * family; falls back to all coupons if a family has no candidates.
 */
export function autoApplyCouponCandidates(
  all: CartCouponOption[],
  preferOuter: boolean
): CartCouponOption[] {
  if (all.length === 0) return all;
  const outer = all.filter((c) => c.tierUnit === "outer");
  const packets = all.filter((c) => c.tierUnit !== "outer");
  if (preferOuter) {
    return outer.length > 0 ? outer : all;
  }
  return packets.length > 0 ? packets : all;
}

export type { ProductPackagingForCoupon };

/**
 * Builds POST /api/coupons/validate lines. When `packagingPerLine` is provided (from
 * POST /api/cart/coupon-packaging), `quantity` uses MongoDB packaging + pricingUnit so
 * carton/box/bag/list units convert to packets for tier thresholds.
 * `orderMode` and `rawQuantity` let the server count outer cartons/bags for `tierUnit: "outer"` coupons.
 */
export function cartLinesForCouponApi(
  items: CartItem[],
  packagingPerLine?: (ProductPackagingForCoupon | null)[] | null
) {
  return items.map((ci, idx) => {
    const pk = pricedPacketCount(ci);
    const lineSubtotal = ci.pricePerUnit * pk;
    const pkg = packagingPerLine?.[idx] ?? null;
    const tierQty =
      pkg != null
        ? computeCouponTierPacketCount({
            lineSubtotalInclGst: lineSubtotal,
            unitPriceWithGst: ci.pricePerUnit,
            product: pkg,
            clientPacketQuantity: pk,
          })
        : pk;
    const comboPk = ci.comboPricedPackets ?? 0;
    const comboSubtotalInclGst =
      ci.comboSubtotalInclGst != null && ci.comboSubtotalInclGst > 0
        ? ci.comboSubtotalInclGst
        : comboPk > 0 && pk > 0
          ? (lineSubtotal * comboPk) / pk
          : 0;
    return {
      productMongoId: ci.mongoProductId,
      /** Matches MongoDB Product.legacyId — lets coupons work when mongo ids were not stored on cart add */
      legacyProductId: ci.productId,
      categoryMongoId: ci.categoryMongoId,
      sellerId: ci.sellerId,
      size: ci.size,
      orderMode: normalizeOrderMode(ci.orderMode),
      rawQuantity: ci.quantity,
      /** Priced packets — combo / couponable split */
      quantity: pk,
      /** Packaging-aware packet count for tier thresholds (omit when same as quantity) */
      ...(tierQty !== pk ? { tierPacketQuantity: tierQty } : {}),
      lineSubtotal,
      lineBasicSubtotal: ci.basicPricePerUnit * pk,
      ...(comboSubtotalInclGst > 0 ? { comboSubtotalInclGst } : {}),
    };
  });
}

export type CouponApplyResult = { ok: true } | { ok: false; message: string };

/** POST /api/coupons/validate success and error bodies */
export type CouponValidateResponseJson = {
  valid?: boolean;
  reason?: string;
  message?: string;
  discountAmount?: number;
  /** Set when the server picked the best offer (no user code). */
  autoApplied?: boolean;
  /** Uppercase coupon code when an offer applies; null when no volume offer. */
  appliedCode?: string | null;
  /** Server-computed GST-inclusive cart subtotal (authoritative when lines use Mongo product ids) */
  cartSubtotalInclGst?: number;
  eligiblePacketCount?: number;
};
