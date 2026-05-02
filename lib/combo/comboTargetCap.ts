import { normalizeOrderMode, pricedPacketCount, type CartOrderMode } from "@/lib/cart/packetLine";
import type { ThresholdUnit } from "@/lib/comboRules/thresholdUnits";
import { formatCountWithUnit } from "@/lib/comboRules/thresholdUnits";
import type { ComboRuleGuard } from "@/lib/combo/comboAddGuard";

/** Guard rules including target cap (same fields as DB / API). */
export type ComboRuleGuardWithCap = ComboRuleGuard;

export function normalizeSlug(s: string): string {
  return s.trim().toLowerCase();
}

function slugInList(slug: string, list: string[]): boolean {
  if (!list.length) return false;
  const n = normalizeSlug(slug);
  return list.some((t) => normalizeSlug(t) === n);
}

/** Contribution of one cart line in the rule's target threshold unit (aligned with combo pricing). */
export function cartLineTargetContribution(
  item: {
    productSlug: string;
    orderMode?: CartOrderMode;
    quantity: number;
    qtyPerBag: number;
    pcsPerPacket?: number;
    /** When set (e.g. from catalog), matches resolver carton thresholds; else defaults to 1. */
    packetsPerCarton?: number;
  },
  unit: ThresholdUnit
): number {
  const pk = Math.max(
    0,
    pricedPacketCount({
      orderMode: item.orderMode,
      quantity: item.quantity,
      qtyPerBag: item.qtyPerBag,
      pcsPerPacket: item.pcsPerPacket ?? 0,
    })
  );
  const pb = Math.max(1, Number(item.qtyPerBag) || 1);
  const ppc = Math.max(1, Number(item.packetsPerCarton) || 1);
  const mode = normalizeOrderMode(item.orderMode);
  const q = Math.max(0, Number(item.quantity) || 0);
  switch (unit) {
    case "packets":
      return pk;
    case "bags":
      if (mode === "master_bag") return q;
      return pk / pb;
    case "cartons":
      return pk / ppc;
    default:
      return pk / pb;
  }
}

/** Sum target-side amounts in `unit` for all lines matching `productSlug`. */
export function sumTargetAmountForSlug(
  productSlug: string,
  cartItems: Array<{
    productSlug: string;
    orderMode?: CartOrderMode;
    quantity: number;
    qtyPerBag: number;
    pcsPerPacket?: number;
    packetsPerCarton?: number;
  }>,
  unit: ThresholdUnit
): number {
  const n = normalizeSlug(productSlug);
  let sum = 0;
  for (const ci of cartItems) {
    if (normalizeSlug(ci.productSlug) !== n) continue;
    sum += cartLineTargetContribution(ci, unit);
  }
  return sum;
}

/** Minimum cap value across rules that list this slug as a target (strictest). */
export function effectiveTargetCapForSlug(
  productSlug: string,
  rules: ComboRuleGuardWithCap[]
): { cap: number; unit: ThresholdUnit } | null {
  const n = normalizeSlug(productSlug);
  let bestCap: number | null = null;
  let unit: ThresholdUnit = "bags";
  for (const r of rules) {
    if (!slugInList(productSlug, r.targetSlugs)) continue;
    const cap =
      typeof r.minTargetBags === "number" && Number.isFinite(r.minTargetBags) ? Math.max(0, r.minTargetBags) : 1;
    const u = (r.targetThresholdUnit as ThresholdUnit | undefined) ?? "bags";
    if (bestCap === null || cap < bestCap) {
      bestCap = cap;
      unit = u;
    }
  }
  if (bestCap === null) return null;
  return { cap: bestCap, unit };
}

/**
 * If adding/updating would push total target amount for this slug above `cap`, return false.
 * `proposedLine` replaces an existing line when `replaceKey` matches line identity (same product+size+seller+mode).
 */
export function wouldExceedTargetCap(
  productSlug: string,
  cartItems: Array<{
    productSlug: string;
    orderMode?: CartOrderMode;
    quantity: number;
    qtyPerBag: number;
    pcsPerPacket?: number;
    packetsPerCarton?: number;
    productId: number;
    size: string;
    sellerId: string;
  }>,
  proposedLine: {
    productSlug: string;
    orderMode?: CartOrderMode;
    quantity: number;
    qtyPerBag: number;
    pcsPerPacket?: number;
    packetsPerCarton?: number;
    productId: number;
    size: string;
    sellerId: string;
  },
  rules: ComboRuleGuardWithCap[]
): boolean {
  const eff = effectiveTargetCapForSlug(productSlug, rules);
  if (!eff) return false;

  const { cap, unit } = eff;
  const n = normalizeSlug(productSlug);
  const sid = (s: string | undefined) => (s && s.length > 0 ? s : "default");

  let foundSameLine = false;
  let total = 0;
  for (const ci of cartItems) {
    if (normalizeSlug(ci.productSlug) !== n) continue;
    const sameLine =
      ci.productId === proposedLine.productId &&
      ci.size === proposedLine.size &&
      sid(ci.sellerId) === sid(proposedLine.sellerId) &&
      normalizeOrderMode(ci.orderMode) === normalizeOrderMode(proposedLine.orderMode);
    if (sameLine) {
      foundSameLine = true;
      total += cartLineTargetContribution(
        {
          ...ci,
          quantity: proposedLine.quantity,
          orderMode: proposedLine.orderMode,
          qtyPerBag: proposedLine.qtyPerBag,
          pcsPerPacket: proposedLine.pcsPerPacket ?? ci.pcsPerPacket,
          packetsPerCarton: proposedLine.packetsPerCarton ?? ci.packetsPerCarton,
        },
        unit
      );
    } else {
      total += cartLineTargetContribution(ci, unit);
    }
  }
  if (!foundSameLine) {
    total += cartLineTargetContribution(proposedLine, unit);
  }

  return total > cap + 1e-6;
}

export function comboTargetMaxReachedMessage(cap: number, unit: ThresholdUnit): string {
  const n = Math.max(0, Math.floor(cap));
  return `Maximum limit for this combo product reached (${formatCountWithUnit(n, unit)}). To purchase more, please add the non-combo version of this product.`;
}
