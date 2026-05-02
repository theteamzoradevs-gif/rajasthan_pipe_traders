function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Volume / tier offers must never wipe the cart: cap at the steepest published RPT tier (12%)
 * even if a coupon row is mis-keyed (e.g. flat ₹ = subtotal or 100% tier).
 */
const MAX_VOLUME_DISCOUNT_PERCENT = 12;

export type PacketTier = { minPackets: number; value: number };

export type CouponTierUnit = "packets" | "outer";

export type CouponLean = {
  code: string;
  name?: string;
  description?: string;
  discountType: "percentage" | "flat";
  packetTiers: PacketTier[];
  /** How `minPackets` thresholds are counted: packets vs outer cartons/bags (see Coupon model). */
  tierUnit?: CouponTierUnit;
  applicableProductIds?: { toString(): string }[];
  applicableCategoryIds?: { toString(): string }[];
  isActive?: boolean;
};

/**
 * Cart line for coupon math. `lineSubtotal` is always GST-inclusive (matches storefront cart totals).
 * `quantity` is priced packet count (see `pricedPacketCount`).
 */
export type CartLineInput = {
  productMongoId?: string;
  categoryMongoId?: string;
  /**
   * Priced packet count (bags→packets) — used for combo / couponable packet split with lineSubtotal.
   */
  quantity: number;
  /**
   * When set (from Mongo packaging + pricingUnit), used only for packet-tier thresholds (minPackets).
   * Falls back to `quantity` when omitted.
   */
  tierPacketQuantity?: number;
  /**
   * When set (from Mongo packaging + order mode), used for `tierUnit === "outer"` thresholds.
   * Falls back to `quantity` when omitted (legacy lines without packaging).
   */
  tierOuterUnitQuantity?: number;
  /** GST-inclusive line total (₹) */
  lineSubtotal: number;
  /** Ex-GST line total when known (₹) */
  lineBasicSubtotal?: number;
  /**
   * GST-inclusive value of combo net-priced packets on this line.
   * Coupon discounts apply only to (lineSubtotal − comboSubtotalInclGst).
   */
  comboSubtotalInclGst?: number;
};

function idSet(ids: unknown[] | undefined): Set<string> {
  const s = new Set<string>();
  if (!ids?.length) return s;
  for (const x of ids) {
    if (x != null) s.add(String(x));
  }
  return s;
}

/** Line qualifies when product or category matches restriction lists; empty lists = all lines qualify. */
export function lineMatchesScope(
  line: CartLineInput,
  productIds: Set<string>,
  categoryIds: Set<string>
): boolean {
  const restricted = productIds.size > 0 || categoryIds.size > 0;
  if (!restricted) return true;
  const pid = line.productMongoId?.trim();
  const cid = line.categoryMongoId?.trim();
  if (productIds.size > 0 && pid && productIds.has(pid)) return true;
  if (categoryIds.size > 0 && cid && categoryIds.has(cid)) return true;
  return false;
}

export type EligibleTotals = {
  eligibleSubtotal: number;
  eligibleQuantity: number;
  eligibleLineCount: number;
};

/** Portion of the line that coupons may discount (excludes RPT combo net amounts). */
export function couponableLineSubtotalInclGst(line: CartLineInput): number {
  const total = Math.max(0, line.lineSubtotal);
  const combo =
    line.comboSubtotalInclGst != null
      ? Math.min(Math.max(0, line.comboSubtotalInclGst), total)
      : 0;
  return roundMoney(Math.max(0, total - combo));
}

function couponablePacketQuantity(line: CartLineInput): number {
  const q = Math.max(0, line.quantity);
  if (q <= 0 || line.lineSubtotal <= 0) return 0;
  const combo = line.comboSubtotalInclGst != null ? Math.max(0, line.comboSubtotalInclGst) : 0;
  if (combo <= 0) return Math.floor(q);
  const comboFrac = Math.min(1, combo / line.lineSubtotal);
  return Math.max(0, Math.floor(q * (1 - comboFrac) + 1e-9));
}

export function eligibleTotalsForCoupon(coupon: CouponLean, lines: CartLineInput[]): EligibleTotals {
  const productIds = idSet(coupon.applicableProductIds as unknown[]);
  const categoryIds = idSet(coupon.applicableCategoryIds as unknown[]);
  let eligibleSubtotal = 0;
  let eligibleQuantity = 0;
  let eligibleLineCount = 0;
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    if (!lineMatchesScope(line, productIds, categoryIds)) continue;
    const couponable = couponableLineSubtotalInclGst(line);
    const cq = couponablePacketQuantity(line);
    eligibleSubtotal += couponable;
    eligibleQuantity += cq;
    if (couponable > 0) eligibleLineCount += 1;
  }
  return { eligibleSubtotal, eligibleQuantity, eligibleLineCount };
}

function effectiveTierUnit(coupon: CouponLean): CouponTierUnit {
  return coupon.tierUnit === "outer" ? "outer" : "packets";
}

function tierThresholdQuantity(line: CartLineInput, coupon: CouponLean): number {
  const u = effectiveTierUnit(coupon);
  if (u === "outer") {
    return Math.max(0, line.tierOuterUnitQuantity ?? line.quantity);
  }
  return Math.max(0, line.tierPacketQuantity ?? line.quantity);
}

/** Full GST subtotals on scope-matched lines (includes combo net value) — used for tier thresholds. */
export function grossEligibleTotalsForCoupon(
  coupon: CouponLean,
  lines: CartLineInput[]
): { grossSubtotal: number; grossQuantity: number; grossLineCount: number } {
  const productIds = idSet(coupon.applicableProductIds as unknown[]);
  const categoryIds = idSet(coupon.applicableCategoryIds as unknown[]);
  let grossSubtotal = 0;
  let grossQuantity = 0;
  let grossLineCount = 0;
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    if (!lineMatchesScope(line, productIds, categoryIds)) continue;
    grossSubtotal += Math.max(0, line.lineSubtotal);
    grossQuantity += tierThresholdQuantity(line, coupon);
    grossLineCount += 1;
  }
  return {
    grossSubtotal: roundMoney(grossSubtotal),
    grossQuantity,
    grossLineCount,
  };
}

/**
 * Pick the best unlocked tier: highest `minPackets` such that `packetCount >= minPackets`.
 * For duplicate `minPackets`, the larger `value` wins.
 */
export function selectPacketTier(tiers: PacketTier[], packetCount: number): PacketTier | null {
  let best: PacketTier | null = null;
  for (const t of tiers) {
    if (packetCount < t.minPackets) continue;
    if (!best || t.minPackets > best.minPackets) {
      best = t;
    } else if (t.minPackets === best.minPackets && t.value > best.value) {
      best = t;
    }
  }
  return best;
}

export type DiscountResult = {
  discountAmount: number;
};

export function computeDiscountAmount(
  coupon: CouponLean,
  eligibleSubtotal: number,
  tier: PacketTier
): DiscountResult {
  const sub = Math.max(0, eligibleSubtotal);
  if (coupon.discountType === "flat") {
    const off = Math.max(0, Number(tier.value) || 0);
    return { discountAmount: Math.min(sub, off) };
  }
  const pct = Math.max(0, Math.min(100, Number(tier.value) || 0));
  return { discountAmount: Math.round((sub * pct) / 100) };
}

export type ValidateCouponResult =
  | {
      ok: true;
      discountAmount: number;
      eligibleSubtotal: number;
      eligibleQuantity: number;
      eligibleLineCount: number;
      cartSubtotalInclGst: number;
      /** Total packets on eligible lines (tier threshold basis). */
      eligiblePacketCount: number;
    }
  | { ok: false; reason: string };

function sumCartSubtotal(lines: CartLineInput[]): number {
  let t = 0;
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    t += Math.max(0, line.lineSubtotal);
  }
  return roundMoney(t);
}

export function validateCouponAgainstCart(coupon: CouponLean | null, lines: CartLineInput[]): ValidateCouponResult {
  const activeLines = lines.filter((l) => l.quantity > 0 && Number.isFinite(l.lineSubtotal));
  if (activeLines.length === 0) {
    return { ok: false, reason: "Cart is empty" };
  }

  if (!coupon) {
    return { ok: false, reason: "Invalid or expired coupon" };
  }
  if (!coupon.isActive) {
    return { ok: false, reason: "Coupon is not active" };
  }
  const tiers = Array.isArray(coupon.packetTiers) ? coupon.packetTiers : [];
  if (tiers.length === 0) {
    return { ok: false, reason: "Coupon is not configured" };
  }

  const cartSubtotalInclGst = sumCartSubtotal(activeLines);
  const cartCouponableSubtotalInclGst = roundMoney(
    activeLines.reduce((s, l) => s + couponableLineSubtotalInclGst(l), 0)
  );
  const { eligibleSubtotal, eligibleQuantity, eligibleLineCount } = eligibleTotalsForCoupon(coupon, activeLines);
  const { grossSubtotal, grossQuantity, grossLineCount } = grossEligibleTotalsForCoupon(coupon, activeLines);
  const productIds = idSet(coupon.applicableProductIds as unknown[]);
  const categoryIds = idSet(coupon.applicableCategoryIds as unknown[]);
  const restricted = productIds.size > 0 || categoryIds.size > 0;
  if (restricted && grossLineCount === 0) {
    return { ok: false, reason: "No items in your cart match this coupon" };
  }

  const tier = selectPacketTier(tiers, grossQuantity);
  if (!tier) {
    const lowest = Math.min(...tiers.map((t) => t.minPackets));
    const outer = effectiveTierUnit(coupon) === "outer";
    return {
      ok: false,
      reason: outer
        ? `At least ${lowest} eligible outer units required (cartons and master bags; thresholds use carton/bag counts from your catalog)`
        : `At least ${lowest} eligible packets required (cartons/bags count toward packet totals per product)`,
    };
  }

  if (
    (coupon.discountType === "percentage" || coupon.discountType === "flat") &&
    eligibleSubtotal <= 0 &&
    grossSubtotal > 0
  ) {
    return {
      ok: false,
      reason:
        "Combo-priced items are excluded from this coupon. Add regular-priced items, or turn off combo pricing for 20/25MM clips in the cart.",
    };
  }

  let { discountAmount } = computeDiscountAmount(coupon, eligibleSubtotal, tier);
  discountAmount = roundMoney(discountAmount);
  const maxByPublishedTier = roundMoney(
    Math.max(0, eligibleSubtotal) * (MAX_VOLUME_DISCOUNT_PERCENT / 100)
  );
  discountAmount = Math.min(discountAmount, maxByPublishedTier);
  if (discountAmount > cartCouponableSubtotalInclGst) {
    discountAmount = cartCouponableSubtotalInclGst;
  }
  return {
    ok: true,
    discountAmount,
    eligibleSubtotal: roundMoney(eligibleSubtotal),
    eligibleQuantity,
    eligibleLineCount,
    cartSubtotalInclGst,
    eligiblePacketCount: grossQuantity,
  };
}

const BANNER_THEMES = ["blue", "indigo", "green", "amber", "brown"] as const;
export type CouponBannerThemeKey = (typeof BANNER_THEMES)[number];

export function themeKeyOrDefault(key: string | undefined, index = 0): CouponBannerThemeKey {
  if (key && (BANNER_THEMES as readonly string[]).includes(key)) {
    return key as CouponBannerThemeKey;
  }
  return BANNER_THEMES[index % BANNER_THEMES.length]!;
}

export function toPublicCouponBanner(doc: Record<string, unknown>, index = 0): Record<string, unknown> {
  const tiers = doc.packetTiers as PacketTier[] | undefined;
  const dt = doc.discountType;
  const name = String(doc.name ?? doc.code ?? "");
  const desc = typeof doc.description === "string" ? doc.description : "";
  let discountStub = "";
  if (Array.isArray(tiers) && tiers.length > 0) {
    const maxVal = Math.max(...tiers.map((t) => t.value));
    discountStub =
      dt === "percentage"
        ? `${maxVal}%`
        : `₹${maxVal.toLocaleString("en-IN")}`;
  }
  const tierUnit = doc.tierUnit === "outer" ? "outer" : "packets";
  return {
    code: doc.code,
    discount: discountStub,
    label: "OFF",
    condition: name,
    desc,
    theme: themeKeyOrDefault(undefined, index),
    tierUnit,
  };
}
