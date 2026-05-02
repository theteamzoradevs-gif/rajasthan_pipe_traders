import { normalizeOrderMode, pricedPacketCount, type CartOrderMode } from "@/lib/cart/packetLine";
import { parseThresholdUnit, type ThresholdUnit } from "@/lib/comboRules/thresholdUnits";

/**
 * Client + server: decide if a product slug may be newly added to the cart
 * when it appears as a combo *target* (requires corresponding *trigger* lines first).
 * `minTargetBags` + `targetThresholdUnit` define the max target-side amount for combo (see comboTargetCap).
 */

export type ComboRuleGuard = {
  _id: string;
  /** Rule display name (from DB) */
  name?: string;
  /** Trigger pool: explicit `triggerSlugs`, or if empty then products in `triggerCategoryIds` */
  triggerSlugs: string[];
  /** Target pool: explicit `targetSlugs`, or if empty then products in `targetCategoryIds` */
  targetSlugs: string[];
  /** Fallback targets (explicit slugs only; not expanded from categories) */
  fallbackTargetSlugs?: string[];
  minTriggerBags?: number;
  minTargetBags?: number;
  triggerThresholdUnit?: ThresholdUnit;
  targetThresholdUnit?: ThresholdUnit;
  suggestionMessage?: string;
  /** Category ObjectIds as strings (for admin / diagnostics) */
  triggerCategoryIds?: string[];
  targetCategoryIds?: string[];
  isActive?: boolean;
};

function normalizeSlug(s: string): string {
  return s.trim().toLowerCase();
}

function slugInList(slug: string, list: string[]): boolean {
  if (!list.length) return false;
  const n = normalizeSlug(slug);
  return list.some((t) => normalizeSlug(t) === n);
}

/** Dedupe by normalized slug; keep first occurrence’s spelling for URLs. */
function uniqueSlugsPreservingOrder(slugs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of slugs) {
    const s = raw.trim();
    if (!s) continue;
    const k = normalizeSlug(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/**
 * True if `productSlug` is not constrained by any active rule, OR for every active rule that
 * lists this slug as a target, the cart's combined trigger quantity meets that rule threshold.
 * Multiple trigger lines/products can combine toward one rule threshold.
 */
export function isEligibleForCombo(
  productSlug: string,
  cartItems: CartLineForComboTriggerThreshold[],
  rules: ComboRuleGuard[]
): boolean {
  const applicable = rules.filter((r) => slugInList(productSlug, r.targetSlugs));
  if (applicable.length === 0) return true;

  // Enforce single combo target family in cart: if one target slug is already present,
  // block adding a different target slug from the same applicable target pool.
  const requested = normalizeSlug(productSlug);
  const applicableTargetSet = new Set<string>();
  for (const rule of applicable) {
    for (const s of rule.targetSlugs ?? []) {
      const n = normalizeSlug(String(s));
      if (n) applicableTargetSet.add(n);
    }
  }
  for (const line of cartItems) {
    const inCart = normalizeSlug(String(line.productSlug ?? ""));
    if (!inCart) continue;
    if (!applicableTargetSet.has(inCart)) continue;
    if (inCart !== requested) return false;
  }

  return applicable.every((rule) => {
    const minTrig = resolveMinTriggerBagsForRule(rule);
    const trigUnit = parseThresholdUnit(rule.triggerThresholdUnit, "bags");
    let triggerAmount = 0;
    for (const line of cartItems) {
      if (!slugInList(line.productSlug, rule.triggerSlugs)) continue;
      triggerAmount += lineContributionInThresholdUnitFromCart(line, trigUnit);
    }
    return triggerAmount + 1e-6 >= minTrig;
  });
}

/** True if slug appears in any active rule’s trigger pool (not based on product `isEligibleForCombo`). */
export function isComboTriggerSlug(productSlug: string, rules: ComboRuleGuard[]): boolean {
  return rules.some((r) => slugInList(productSlug, r.triggerSlugs));
}

/** True if slug appears in any active rule’s target pool. */
export function isComboTargetSlug(productSlug: string, rules: ComboRuleGuard[]): boolean {
  return rules.some((r) => slugInList(productSlug, r.targetSlugs));
}

/** True if slug appears in any active rule’s fallback target list. */
export function isComboFallbackTargetSlug(productSlug: string, rules: ComboRuleGuard[]): boolean {
  return rules.some((r) => slugInList(productSlug, r.fallbackTargetSlugs ?? []));
}

/** Default when no admin “suggestion message” is set on the matching combo rule (cart toast). */
export const COMBO_TARGET_ADD_BLOCKED_MESSAGE =
  "This item combo ka part hai, so it can't be purchased alone. Pehle ek qualifying product add karo — phir you'll be able to add this item.";

/** PDP default intro when exactly one qualifying (trigger) SKU exists for this combo target. */
export const COMBO_TARGET_PDP_DEFAULT_INTRO_ONE =
  "Yeh product hamari combo offer ka hissa hai — ise tabhi cart mein add kar sakte ho jab pehle se neeche wala qualifying (trigger) product cart mein ho. Phir yeh product add karein aur combo net rate ka fayda uthayein.";

/** PDP default intro when multiple qualifying (trigger) SKUs exist. */
export const COMBO_TARGET_PDP_DEFAULT_INTRO_MULTI =
  "Yeh product hamari combo offer ka hissa hai — ise akele cart mein tabhi add kar sakte ho jab pehle se koi qualifying (trigger) product cart mein ho. Pehle neeche diye gaye items mein se koi ek add karein, phir yeh product add karein; saath mein buy karke combo net rate ka fayda uthayein.";

/** PDP / cart: when slug count is unknown (e.g. rules did not resolve triggers). */
export const COMBO_TARGET_PDP_DEFAULT_INTRO_FALLBACK =
  "Yeh product hamari combo offer ka hissa hai — pehle qualifying (trigger) product apni cart mein add karein, phir yeh product add karein.";

/** Section title above trigger links on PDP / cart — singular vs plural. */
export function comboQualifyingTriggersSectionHeading(qualifyingSlugCount: number): string {
  if (qualifyingSlugCount <= 1) {
    return "Qualifying / trigger product — pehle yeh apni cart mein add karein:";
  }
  return "Qualifying / trigger products — pehle inmein se koi ek apni cart mein add karein:";
}

export type ComboTargetAddBlockedInfo = {
  message: string;
  /** Trigger / qualifying product slugs for PDP links (`/products/[slug]`). */
  qualifyingProductSlugs: string[];
  /** Optional custom heading for links in cart notice UI. */
  linksHeading?: string;
};

export type ComboTargetAlreadyInCartConflict = {
  existingTargetSlug: string;
  fallbackTargetSlugs: string[];
};

/**
 * If a different combo target from the same applicable rule is already in cart,
 * return conflict info + fallback target slugs (regular-rate alternatives).
 */
export function comboTargetAlreadyInCartConflict(
  productSlug: string,
  cartItems: CartLineForComboTriggerThreshold[],
  rules: ComboRuleGuard[] | null | undefined
): ComboTargetAlreadyInCartConflict | null {
  if (!rules?.length) return null;
  const applicable = rules.filter((r) => slugInList(productSlug, r.targetSlugs));
  if (applicable.length === 0) return null;

  const requested = normalizeSlug(productSlug);
  let existingTargetSlug: string | null = null;
  const fallbackCollected: string[] = [];

  for (const rule of applicable) {
    for (const line of cartItems) {
      if (!slugInList(line.productSlug, rule.targetSlugs)) continue;
      const inCart = normalizeSlug(line.productSlug);
      if (inCart && inCart !== requested) {
        existingTargetSlug = inCart;
        break;
      }
    }
    for (const s of rule.fallbackTargetSlugs ?? []) {
      const n = normalizeSlug(String(s));
      if (n) fallbackCollected.push(n);
    }
    if (existingTargetSlug) break;
  }

  if (!existingTargetSlug) return null;
  return {
    existingTargetSlug,
    fallbackTargetSlugs: uniqueSlugsPreservingOrder(fallbackCollected),
  };
}

/**
 * When a combo *target* is blocked: copy (first matching rule’s B2C suggestion, else default)
 * plus all trigger slugs from rules that list this product as a target.
 */
export function comboTargetAddBlockedInfo(
  productSlug: string,
  rules: ComboRuleGuard[] | null | undefined
): ComboTargetAddBlockedInfo {
  const fallback: ComboTargetAddBlockedInfo = {
    message: COMBO_TARGET_ADD_BLOCKED_MESSAGE,
    qualifyingProductSlugs: [],
  };
  if (!rules?.length) return fallback;
  const applicable = rules.filter((r) => slugInList(productSlug, r.targetSlugs));
  if (applicable.length === 0) return fallback;

  const qualifyingProductSlugs = uniqueSlugsPreservingOrder(applicable.flatMap((r) => r.triggerSlugs));

  let message = COMBO_TARGET_ADD_BLOCKED_MESSAGE;
  for (const r of applicable) {
    const custom = r.suggestionMessage?.trim();
    if (custom) {
      message = custom;
      break;
    }
  }
  return { message, qualifyingProductSlugs };
}

/**
 * Product page: when slug is a combo *target* in an active rule, return intro + trigger links.
 * Prefer admin suggestion text when set on a matching rule; else singular vs multi default intro.
 * Returns `null` if there are no rules or slug is not in any rule’s target pool.
 */
export function comboTargetPdpNoticeInfo(
  productSlug: string,
  rules: ComboRuleGuard[] | null | undefined
): ComboTargetAddBlockedInfo | null {
  if (!rules?.length) return null;
  const applicable = rules.filter((r) => slugInList(productSlug, r.targetSlugs));
  if (applicable.length === 0) return null;

  const qualifyingProductSlugs = uniqueSlugsPreservingOrder(applicable.flatMap((r) => r.triggerSlugs));

  let message =
    qualifyingProductSlugs.length <= 1 ? COMBO_TARGET_PDP_DEFAULT_INTRO_ONE : COMBO_TARGET_PDP_DEFAULT_INTRO_MULTI;
  for (const r of applicable) {
    const custom = r.suggestionMessage?.trim();
    if (custom) {
      message = custom;
      break;
    }
  }
  return { message, qualifyingProductSlugs };
}

/** Cart fields needed to evaluate trigger-side thresholds (aligns with `resolveCartComboPricing`). */
export type CartLineForComboTriggerThreshold = {
  productSlug: string;
  quantity: number;
  orderMode?: CartOrderMode;
  qtyPerBag: number;
  pcsPerPacket: number;
  packetsPerCarton?: number;
};

function resolveMinTriggerBagsForRule(r: ComboRuleGuard): number {
  return typeof r.minTriggerBags === "number" && Number.isFinite(r.minTriggerBags)
    ? Math.max(0, r.minTriggerBags)
    : 3;
}

function lineBagsTowardThresholdFromCart(line: CartLineForComboTriggerThreshold): number {
  const mode = normalizeOrderMode(line.orderMode);
  const pb = Math.max(1, Number(line.qtyPerBag) || 1);
  const pk = pricedPacketCount(line);
  if (mode === "master_bag") return Math.max(0, Number(line.quantity) || 0);
  return pk / pb;
}

function lineContributionInThresholdUnitFromCart(
  line: CartLineForComboTriggerThreshold,
  unit: ThresholdUnit
): number {
  const pk = pricedPacketCount(line);
  const ppc = Math.max(1, Number(line.packetsPerCarton) || 1);
  switch (unit) {
    case "packets":
      return pk;
    case "bags":
      return lineBagsTowardThresholdFromCart(line);
    case "cartons":
      return pk / ppc;
    default:
      return lineBagsTowardThresholdFromCart(line);
  }
}

/**
 * When true, hide the combo-target PDP notice: cart meets trigger **quantity** thresholds
 * (`minTriggerBags` in `triggerThresholdUnit`) for every rule that lists `targetProductSlug` as a target.
 * Mirrors `triggerMet` in `resolveCartComboPricing` (trigger side only).
 */
export function shouldHideComboTargetPdpNotice(
  targetProductSlug: string,
  cartLines: CartLineForComboTriggerThreshold[],
  rules: ComboRuleGuard[] | null | undefined
): boolean {
  if (!rules?.length) return false;

  const applicable = rules.filter((r) => slugInList(targetProductSlug, r.targetSlugs));
  if (applicable.length === 0) return false;

  for (const rule of applicable) {
    const minTrig = resolveMinTriggerBagsForRule(rule);
    const trigUnit = parseThresholdUnit(rule.triggerThresholdUnit, "bags");

    let triggerAmount = 0;
    for (const line of cartLines) {
      if (!slugInList(line.productSlug, rule.triggerSlugs)) continue;
      triggerAmount += lineContributionInThresholdUnitFromCart(line, trigUnit);
    }

    if (triggerAmount + 1e-6 < minTrig) return false;
  }

  return true;
}

/** Target slugs unlocked by this trigger slug across active rules (unique, normalized). */
export function comboTargetSlugsForTrigger(
  triggerProductSlug: string,
  rules: ComboRuleGuard[] | null | undefined
): string[] {
  if (!rules?.length) return [];
  const collected: string[] = [];
  for (const r of rules) {
    if (!slugInList(triggerProductSlug, r.triggerSlugs)) continue;
    for (const t of r.targetSlugs ?? []) {
      const s = String(t).trim().toLowerCase();
      if (s) collected.push(s);
    }
  }
  return uniqueSlugsPreservingOrder(collected);
}

/**
 * True when this trigger product satisfies trigger thresholds for every applicable rule.
 * Mirrors `triggerMet` checks in resolver (`minTriggerBags` + `triggerThresholdUnit`).
 */
export function isComboTriggerConditionMet(
  triggerProductSlug: string,
  cartLines: CartLineForComboTriggerThreshold[],
  rules: ComboRuleGuard[] | null | undefined
): boolean {
  if (!rules?.length) return false;
  const applicable = rules.filter((r) => slugInList(triggerProductSlug, r.triggerSlugs));
  if (applicable.length === 0) return false;

  for (const rule of applicable) {
    const minTrig = resolveMinTriggerBagsForRule(rule);
    const trigUnit = parseThresholdUnit(rule.triggerThresholdUnit, "bags");
    let triggerAmount = 0;
    for (const line of cartLines) {
      if (!slugInList(line.productSlug, rule.triggerSlugs)) continue;
      triggerAmount += lineContributionInThresholdUnitFromCart(line, trigUnit);
    }
    if (triggerAmount + 1e-6 < minTrig) return false;
  }
  return true;
}

/** @deprecated Prefer `comboTargetAddBlockedInfo` when you need trigger links. */
export function messageForComboTargetAddBlocked(
  productSlug: string,
  rules: ComboRuleGuard[] | null | undefined
): string {
  return comboTargetAddBlockedInfo(productSlug, rules).message;
}
