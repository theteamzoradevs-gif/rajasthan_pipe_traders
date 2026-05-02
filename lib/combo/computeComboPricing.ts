/**
 * RPT combo offer: core 20/25MM clip packets priced at net combo rates up to the
 * eligible-packet pool; surplus core packets use list (non-combo) rates.
 */

export type ComboPricingInputLine = {
  /** Stable cart line key */
  key: string;
  pricedPacketCount: number;
  /** List / non-combo (slab-discount-eligible) unit prices */
  listBasicPrice: number;
  listPriceWithGst: number;
  /** When set with combo unit prices, this line can receive combo allocation */
  coreVariant: "20" | "25" | null;
  comboBasicPrice?: number;
  comboPriceWithGst?: number;
  /** Counts toward eligible pool (same unit as packets) */
  isEligibleForCombo: boolean;
  /**
   * Stable combo pool key: category `slug`, or normalized category name, or ObjectId hex.
   * Eligible packets and core lines match only when this string matches (not raw Mongo id only).
   */
  comboPoolCategoryKey?: string | null;
};

export type ComboPricingResultLine = {
  key: string;
  pricedPacketCount: number;
  basicPricePerUnit: number;
  pricePerUnit: number;
  /** Packets on this line priced at combo net rate */
  comboPricedPackets: number;
  /** True when any packets use RPT combo net rate (excluded from coupon discount) */
  isComboApplied: boolean;
  /** GST-inclusive value of combo-priced packets at net combo rate — coupon must not discount this */
  comboSubtotalInclGst: number;
};

export type ComboEligibleTargetProduct = {
  slug: string;
  name: string;
};

export type ComboPricingResult = {
  lines: ComboPricingResultLine[];
  /** Sum of packets from eligible products */
  eligiblePacketTotal: number;
  /** Sum of packets from core 20/25 lines (with combo rates configured) */
  corePacketTotal: number;
  /** min(eligible, core) — combo-priced core packets */
  comboMatchedCorePackets: number;
  cartTotalInclGst: number;
  cartBasicTotal: number;
  /** Estimated savings vs list rate on combo-priced packets (incl. GST) */
  comboSavingsInclGst: number;
  /** Hint when user is close to unlocking more combo */
  smartSuggestion: string | null;
  /**
   * When trigger threshold is met but the cart has no combo target line yet — slugs/names
   * for PDP links (from DB).
   */
  comboEligibleTargets?: ComboEligibleTargetProduct[];
  /**
   * When trigger threshold is not yet met — fallback target slugs from the rule (list-priced alternatives).
   */
  comboFallbackTargets?: ComboEligibleTargetProduct[];
  /**
   * Target slugs currently present in cart but invalid because trigger threshold is not met.
   * Client can use this for simple target -> fallback auto-swap.
   */
  comboSwapTargetSlugs?: string[];
  /**
   * Slugs to remove when a rule has no trigger line in cart:
   * includes that rule's target slugs + fallback target slugs.
   */
  comboRemoveWhenNoTriggerSlugs?: string[];
};

export type ComputeComboPricingOptions = {
  /** When true, core lines use list prices only (for “full coupon” mode). */
  skipComboAllocation?: boolean;
};

function comboCategoryKey(line: ComboPricingInputLine): string | null {
  const raw = line.comboPoolCategoryKey;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function hasConfiguredComboRates(line: ComboPricingInputLine): boolean {
  const cg = line.comboPriceWithGst;
  const cb = line.comboBasicPrice;
  return (
    cg != null &&
    cb != null &&
    Number.isFinite(cg) &&
    Number.isFinite(cb)
  );
}

function blendUnitPrice(
  comboPackets: number,
  comboUnit: number,
  nonComboPackets: number,
  listUnit: number,
  totalPackets: number
): number {
  if (totalPackets <= 0) return listUnit;
  return (comboPackets * comboUnit + nonComboPackets * listUnit) / totalPackets;
}

/**
 * Sort core lines: 20MM variants first, then 25MM, then key for stability.
 */
function sortCoreLines<T extends { coreVariant: "20" | "25"; key: string }>(rows: T[]): T[] {
  const rank = (v: "20" | "25") => (v === "20" ? 0 : 1);
  return [...rows].sort((a, b) => rank(a.coreVariant) - rank(b.coreVariant) || a.key.localeCompare(b.key));
}

export function computeComboPricing(
  inputLines: ComboPricingInputLine[],
  options: ComputeComboPricingOptions = {}
): ComboPricingResult {
  const { skipComboAllocation = false } = options;
  let eligiblePacketTotal = 0;
  for (const line of inputLines) {
    if (line.isEligibleForCombo) {
      eligiblePacketTotal += Math.max(0, line.pricedPacketCount);
    }
  }

  type CoreRow = ComboPricingInputLine & { coreVariant: "20" | "25" };

  const categoryKeys = new Set<string>();
  for (const line of inputLines) {
    const ck = comboCategoryKey(line);
    if (!ck) continue;
    if (line.isEligibleForCombo || (line.coreVariant && hasConfiguredComboRates(line))) {
      categoryKeys.add(ck);
    }
  }

  const coreRowsAll: CoreRow[] = [];
  for (const line of inputLines) {
    if (!line.coreVariant) continue;
    if (!hasConfiguredComboRates(line)) continue;
    coreRowsAll.push(line as CoreRow);
  }

  let corePacketTotal = 0;
  for (const r of coreRowsAll) {
    corePacketTotal += Math.max(0, r.pricedPacketCount);
  }

  const comboAlloc = new Map<string, number>();

  for (const ck of categoryKeys) {
    let eligibleInCat = 0;
    const coreInCat: CoreRow[] = [];
    for (const line of inputLines) {
      if (comboCategoryKey(line) !== ck) continue;
      if (line.isEligibleForCombo) {
        eligibleInCat += Math.max(0, line.pricedPacketCount);
      }
      if (line.coreVariant && hasConfiguredComboRates(line)) {
        coreInCat.push(line as CoreRow);
      }
    }

    const sortedCore = sortCoreLines(coreInCat);
    let corePkInCat = 0;
    for (const r of sortedCore) {
      corePkInCat += Math.max(0, r.pricedPacketCount);
    }

    let budget = skipComboAllocation ? 0 : Math.min(eligibleInCat, corePkInCat);
    for (const row of sortedCore) {
      const pk = Math.max(0, row.pricedPacketCount);
      const take = skipComboAllocation ? 0 : Math.min(pk, budget);
      comboAlloc.set(row.key, (comboAlloc.get(row.key) ?? 0) + take);
      budget -= take;
    }
  }

  const lines: ComboPricingResultLine[] = [];
  let cartTotalInclGst = 0;
  let cartBasicTotal = 0;
  let comboMatchedCorePackets = 0;
  let comboSavingsInclGst = 0;

  for (const line of inputLines) {
    const pk = Math.max(0, line.pricedPacketCount);
    if (pk === 0) {
      lines.push({
        key: line.key,
        pricedPacketCount: 0,
        basicPricePerUnit: line.listBasicPrice,
        pricePerUnit: line.listPriceWithGst,
        comboPricedPackets: 0,
        isComboApplied: false,
        comboSubtotalInclGst: 0,
      });
      continue;
    }

    const coreVariant = line.coreVariant;
    const cg = line.comboPriceWithGst;
    const cb = line.comboBasicPrice;
    const hasCombo =
      coreVariant &&
      cg != null &&
      cb != null &&
      Number.isFinite(cg) &&
      Number.isFinite(cb);

    if (!hasCombo || !coreVariant) {
      cartBasicTotal += line.listBasicPrice * pk;
      cartTotalInclGst += line.listPriceWithGst * pk;
      lines.push({
        key: line.key,
        pricedPacketCount: pk,
        basicPricePerUnit: line.listBasicPrice,
        pricePerUnit: line.listPriceWithGst,
        comboPricedPackets: 0,
        isComboApplied: false,
        comboSubtotalInclGst: 0,
      });
      continue;
    }

    const comboPk = Math.min(pk, comboAlloc.get(line.key) ?? 0);
    const nonComboPk = pk - comboPk;
    comboMatchedCorePackets += comboPk;
    if (comboPk > 0 && cg != null) {
      comboSavingsInclGst += comboPk * (line.listPriceWithGst - cg);
    }

    const basicPricePerUnit = blendUnitPrice(comboPk, cb, nonComboPk, line.listBasicPrice, pk);
    const pricePerUnit = blendUnitPrice(comboPk, cg, nonComboPk, line.listPriceWithGst, pk);

    const comboSubtotalInclGst = comboPk > 0 && cg != null ? roundMoney(comboPk * cg) : 0;

    cartBasicTotal += basicPricePerUnit * pk;
    cartTotalInclGst += pricePerUnit * pk;

    lines.push({
      key: line.key,
      pricedPacketCount: pk,
      basicPricePerUnit,
      pricePerUnit,
      comboPricedPackets: comboPk,
      isComboApplied: comboPk > 0,
      comboSubtotalInclGst,
    });
  }

  let smartSuggestion: string | null = null;
  let surplusAcrossCategories = 0;
  for (const ck of categoryKeys) {
    let eligibleInCat = 0;
    let corePkInCat = 0;
    for (const line of inputLines) {
      if (comboCategoryKey(line) !== ck) continue;
      if (line.isEligibleForCombo) {
        eligibleInCat += Math.max(0, line.pricedPacketCount);
      }
      if (line.coreVariant && hasConfiguredComboRates(line)) {
        corePkInCat += Math.max(0, line.pricedPacketCount);
      }
    }
    surplusAcrossCategories += Math.max(0, corePkInCat - eligibleInCat);
  }

  if (corePacketTotal > 0 && eligiblePacketTotal === 0) {
    smartSuggestion =
      "Add eligible products (same category as your 20MM/25MM clips — 1.4–18MM clips, clamps, batten, wall plugs, etc.) to unlock combo net rates.";
  } else if (surplusAcrossCategories > 0) {
    smartSuggestion = `Add ${surplusAcrossCategories} more packet(s) of eligible products in the same category to price more 20MM/25MM clips at combo net rates (surplus is charged at non-combo list rates).`;
  }

  return {
    lines,
    eligiblePacketTotal,
    corePacketTotal,
    comboMatchedCorePackets,
    cartTotalInclGst,
    cartBasicTotal,
    comboSavingsInclGst: roundMoney(Math.max(0, comboSavingsInclGst)),
    smartSuggestion,
    comboEligibleTargets: undefined,
    comboFallbackTargets: undefined,
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
