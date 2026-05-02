/**
 * RPT B2B combo rules: eligible “Patti” (e.g. Single Cable Nail Clips 4 MM) builds the packet pool
 * that unlocks net combo rates on core 20/25 MM lines (e.g. Double Nail Clamps 20 MM).
 * See `docs/1-4-26 RPT PRICE LIST.pdf` — fallback net rates match the published Single Clip 20MM COMBO row when DB omits combo columns.
 */

import type { ComboPricingInputLine } from "@/lib/combo/computeComboPricing";

/** Legacy IDs from `app/data/products.ts` (static catalog). */
export const RPT_LEGACY_SINGLE_CABLE_NAIL_CLIPS = 1;
export const RPT_LEGACY_DOUBLE_NAIL_CLAMPS = 2;

export const RPT_SLUG_SINGLE_CABLE_NAIL_CLIPS = "cable-nail-clips";
export const RPT_SLUG_DOUBLE_NAIL_CLAMPS = "double-nail-clamp";

/**
 * Optional Mongo `_id` strings (hex) for the same two catalog products — extend if your DB uses fixed IDs.
 * Set via env `RPT_COMBO_PATTI_MONGO_IDS` / `RPT_COMBO_CORE_MONGO_IDS` as comma-separated ObjectId strings.
 */
function mongoIdSet(envVal: string | undefined): Set<string> {
  const s = new Set<string>();
  if (!envVal?.trim()) return s;
  for (const p of envVal.split(",")) {
    const t = p.trim();
    if (t) s.add(t);
  }
  return s;
}

const EXTRA_PATTI_MONGO_IDS = mongoIdSet(
  typeof process !== "undefined" ? process.env.RPT_COMBO_PATTI_MONGO_IDS : undefined
);
const EXTRA_CORE_MONGO_IDS = mongoIdSet(
  typeof process !== "undefined" ? process.env.RPT_COMBO_CORE_MONGO_IDS : undefined
);

/** Collapse spaces so cart `4 MM` matches catalog `4MM`. */
export function normalizeRptSizeKey(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

function isExplicitNoComboSize(normalized: string): boolean {
  return normalized.includes("NOCOMBO") || normalized.includes("NO-COMBO");
}

/** Single Cable Nail Clips — 4 MM patti row counts toward eligible pool. */
export function isRptPatti4mmEligible(params: {
  slug?: string;
  legacyId?: number;
  mongoId?: string;
  cartSizeLabel: string;
}): boolean {
  const { slug, legacyId, mongoId, cartSizeLabel } = params;
  const n = normalizeRptSizeKey(cartSizeLabel);
  if (!/^4(\.0)?MM/.test(n) || isExplicitNoComboSize(n)) return false;

  const sl = slug?.toLowerCase().trim();
  if (sl === RPT_SLUG_SINGLE_CABLE_NAIL_CLIPS) return true;
  if (legacyId === RPT_LEGACY_SINGLE_CABLE_NAIL_CLIPS) return true;
  if (mongoId && EXTRA_PATTI_MONGO_IDS.has(mongoId)) return true;
  return false;
}

/** Double Nail Clamps — 20 MM core line (combo net when pool allows). Excludes NO COMBO rows. */
export function isRptDoubleNailClamp20Core(params: {
  slug?: string;
  legacyId?: number;
  mongoId?: string;
  cartSizeLabel: string;
}): boolean {
  const { slug, legacyId, mongoId, cartSizeLabel } = params;
  const n = normalizeRptSizeKey(cartSizeLabel);
  if (isExplicitNoComboSize(n)) return false;
  if (!/^20(\.0)?MM/.test(n)) return false;

  const sl = slug?.toLowerCase().trim();
  if (sl === RPT_SLUG_DOUBLE_NAIL_CLAMPS) return true;
  if (legacyId === RPT_LEGACY_DOUBLE_NAIL_CLAMPS) return true;
  if (mongoId && EXTRA_CORE_MONGO_IDS.has(mongoId)) return true;
  return false;
}

/** Fallback net combo (ex-GST / incl-GST per packet) when Mongo size row has no combo columns — RPT list Single Clip 20MM COMBO row. */
export const RPT_FALLBACK_DNC_20MM_COMBO_BASIC = 50.3;
export const RPT_FALLBACK_DNC_20MM_COMBO_WITH_GST = 59.35;

function hasFiniteComboRates(input: ComboPricingInputLine): boolean {
  const cb = input.comboBasicPrice;
  const cg = input.comboPriceWithGst;
  return (
    cb != null &&
    cg != null &&
    Number.isFinite(cb) &&
    Number.isFinite(cg) &&
    cb > 0 &&
    cg > 0
  );
}

type LeanRef = {
  slug?: string;
  legacyId?: number;
  _id?: { toString(): string };
};

/**
 * Apply explicit Patti / Core pairing and optional fallback net rates so `computeComboPricing` can match.
 */
export function augmentRptB2bComboLine(
  product: LeanRef,
  line: { size: string },
  input: ComboPricingInputLine
): ComboPricingInputLine {
  const mongoId = product._id != null ? String(product._id) : undefined;

  let next: ComboPricingInputLine = { ...input };

  if (isRptPatti4mmEligible({ slug: product.slug, legacyId: product.legacyId, mongoId, cartSizeLabel: line.size })) {
    next = { ...next, isEligibleForCombo: true };
  }

  if (isRptDoubleNailClamp20Core({ slug: product.slug, legacyId: product.legacyId, mongoId, cartSizeLabel: line.size })) {
    next = {
      ...next,
      coreVariant: "20",
    };
    if (!hasFiniteComboRates(next)) {
      next = {
        ...next,
        comboBasicPrice: RPT_FALLBACK_DNC_20MM_COMBO_BASIC,
        comboPriceWithGst: RPT_FALLBACK_DNC_20MM_COMBO_WITH_GST,
      };
    }
  }

  return next;
}
