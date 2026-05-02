import type { CartOrderMode } from "@/lib/cart/packetLine";
import { normalizeOrderMode, pricedPacketCount } from "@/lib/cart/packetLine";
import type { ComboPricingResult, ComboPricingResultLine } from "@/lib/combo/computeComboPricing";
import type { ComputeComboPricingOptions } from "@/lib/combo/computeComboPricing";
import { normalizeRptSizeKey } from "@/lib/b2b/combo-logic";
import { connectDb } from "@/lib/db/connect";
import { ComboRuleModel } from "@/lib/db/models/ComboRule";
import { ProductModel } from "@/lib/db/models/Product";
import { expandManyComboRulesForRuntime } from "@/lib/combo/expandComboRuleSlugs";
import {
  type ThresholdUnit,
  formatCountWithUnit,
  parseThresholdUnit,
} from "@/lib/comboRules/thresholdUnits";

const DEFAULT_SELLER = "default";

export type IncomingCartLineForCombo = {
  mongoProductId?: string;
  productId?: number;
  /** Client catalog slug (matches PDP / cart) — used when Mongo `product.slug` is missing or mismatched */
  productSlug?: string;
  size: string;
  sellerId?: string;
  orderMode?: CartOrderMode;
  quantity: number;
  qtyPerBag: number;
  pcsPerPacket: number;
  pricePerUnit: number;
  basicPricePerUnit: number;
};

export type LeanCatalogSize = {
  size: string;
  basicPrice: number;
  priceWithGst: number;
  comboBasicPrice?: number;
  comboPriceWithGst?: number;
  coreComboVariant?: "20" | "25";
  countsTowardComboEligible?: boolean;
  qtyPerBag?: number;
  pcsPerPacket?: number;
};

export type LeanPackaging = {
  packetsInMasterBag?: number;
  pktInMasterBag?: number;
  /** Pieces per carton (outer) — used with pcs per packet to derive packets per carton */
  pcsInCartoon?: number;
  pcsPerPacket?: number;
  pcsInPacket?: number;
};

export type LeanProductForCombo = {
  _id: { toString: () => string };
  slug?: string;
  legacyId?: number;
  isEligibleForCombo?: boolean;
  category?: unknown;
  packaging?: LeanPackaging;
  sizes?: LeanCatalogSize[];
  sellers?: Array<{
    sellerId: string;
    sizes?: LeanCatalogSize[];
  }>;
  pricing?: { basicPrice: number; priceWithGst: number };
  sizeOrModel?: string;
};

function normalizeSellerId(sellerId: string | undefined): string {
  return sellerId && sellerId.length > 0 ? sellerId : DEFAULT_SELLER;
}

function lineKey(
  mongoId: string | undefined,
  legacyId: number | undefined,
  size: string,
  sellerId: string,
  mode: CartOrderMode
): string {
  const id = mongoId ?? `legacy:${legacyId ?? 0}`;
  return `${id}|${size}|${normalizeSellerId(sellerId)}|${mode}`;
}

function resolveSizesForSeller(product: LeanProductForCombo, sellerId: string): LeanCatalogSize[] {
  const sid = normalizeSellerId(sellerId);
  if (product.sellers && product.sellers.length > 0) {
    const offer = product.sellers.find((s) => s.sellerId === sid) ?? product.sellers[0];
    return offer.sizes ?? [];
  }
  return product.sizes ?? [];
}

function findSizeRow(sizes: LeanCatalogSize[], sizeLabel: string): LeanCatalogSize | null {
  const exact = sizes.find((s) => s.size === sizeLabel);
  if (exact) return exact;
  const n = normalizeRptSizeKey(sizeLabel);
  if (!n) return null;
  return sizes.find((s) => normalizeRptSizeKey(s.size) === n) ?? null;
}

/**
 * Packets per master bag from DB (size row → packaging → client).
 * This is `packetsPerBag` in (bags × packetsPerBag) + packets.
 */
export function resolveDbPacketsPerBag(
  product: LeanProductForCombo,
  row: LeanCatalogSize | null,
  clientQtyPerBag: number
): number {
  const fromRow = row?.qtyPerBag;
  if (typeof fromRow === "number" && fromRow > 0) return fromRow;
  const pack = product.packaging;
  if (pack) {
    const a = pack.packetsInMasterBag;
    const b = pack.pktInMasterBag;
    if (typeof a === "number" && a > 0) return a;
    if (typeof b === "number" && b > 0) return b;
  }
  const c = Number(clientQtyPerBag);
  return c > 0 ? c : 1;
}

/**
 * Absolute quantity for combo: `(bags × packetsPerBag) + loosePackets` on this line.
 * `master_bag` → quantity is bag count; `packets` → quantity is loose packet count.
 */
export function totalPacketsForLine(line: IncomingCartLineForCombo, packetsPerBag: number): number {
  const mode = normalizeOrderMode(line.orderMode);
  const q = Math.max(0, Number(line.quantity) || 0);
  const pb = Math.max(0, packetsPerBag);
  if (mode === "master_bag") return q * pb;
  return q;
}

/** @deprecated Use {@link totalPacketsForLine} — same formula. */
export function pricedPacketsForComboPool(line: IncomingCartLineForCombo, packetsPerBagFromDb: number): number {
  return totalPacketsForLine(line, packetsPerBagFromDb);
}

function resolveSlugForLine(
  line: IncomingCartLineForCombo,
  product: LeanProductForCombo | undefined
): string | null {
  const fromClient = typeof line.productSlug === "string" ? line.productSlug.trim() : "";
  const fromDb = product?.slug?.trim() ?? "";
  const merged = (fromClient || fromDb).toLowerCase();
  return merged.length > 0 ? merged : null;
}

function normalizeSlugToken(s: string): string {
  return s.trim().toLowerCase();
}

/** True when cart slug equals a rule slug (after trim + lower-case). */
function slugInList(slug: string | null, list: string[]): boolean {
  if (!slug || list.length === 0) return false;
  const s = normalizeSlugToken(slug);
  return list.some((t) => normalizeSlugToken(t) === s);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Min bags threshold from DB (default 3). */
function resolveMinTriggerBags(r: LeanComboRule): number {
  return typeof r.minTriggerBags === "number" && Number.isFinite(r.minTriggerBags)
    ? Math.max(0, r.minTriggerBags)
    : 3;
}

/** Max target-side threshold amount from DB (`minTargetBags` field — used as combo cap, not a minimum). */
function resolveMinTargetBags(r: LeanComboRule): number {
  return typeof r.minTargetBags === "number" && Number.isFinite(r.minTargetBags)
    ? Math.max(0, r.minTargetBags)
    : 1;
}

/**
 * Whole bags still needed to reach a threshold (e.g. min 4, current 1 → 3).
 * Uses ceil when current “bags” are fractional (packets mode).
 */
export function bagsRemainingToThreshold(minBags: number, currentBags: number): number {
  const minB = Math.max(0, minBags);
  const cur = Math.max(0, currentBags);
  const raw = minB - cur;
  if (raw <= 0) return 0;
  return Math.ceil(raw);
}

/**
 * Replaces `{triggerDiff}`, `{targetDiff}`, `{triggerDiffLabel}`, `{targetDiffLabel}`, `{diff}`, `{diffLabel}`.
 * Legacy `{diff}` / `{diffLabel}`: trigger shortfall first, else target.
 */
export function applyComboSuggestionPlaceholders(
  template: string,
  triggerDiff: number,
  targetDiff: number,
  triggerMet: boolean,
  targetMet: boolean,
  triggerUnit: ThresholdUnit,
  targetUnit: ThresholdUnit
): string {
  let legacyDiff = 0;
  if (!triggerMet) legacyDiff = triggerDiff;
  else if (!targetMet) legacyDiff = targetDiff;
  const triggerDiffLabel = formatCountWithUnit(triggerDiff, triggerUnit);
  const targetDiffLabel = formatCountWithUnit(targetDiff, targetUnit);
  const legacyLabel = formatCountWithUnit(
    legacyDiff,
    !triggerMet ? triggerUnit : targetUnit
  );
  return template
    .replace(/\{triggerDiff\}/g, String(triggerDiff))
    .replace(/\{targetDiff\}/g, String(targetDiff))
    .replace(/\{triggerDiffLabel\}/g, triggerDiffLabel)
    .replace(/\{targetDiffLabel\}/g, targetDiffLabel)
    .replace(/\{diff\}/g, String(legacyDiff))
    .replace(/\{diffLabel\}/g, legacyLabel);
}

function deriveComboBasicUnit(comboInclGst: number, listBasic: number, listGst: number): number {
  if (listGst > 1e-9) {
    return roundMoney(comboInclGst * (listBasic / listGst));
  }
  return roundMoney(comboInclGst / 1.18);
}

type LeanComboRule = {
  _id: { toString: () => string };
  name: string;
  triggerSlugs: string[];
  targetSlugs: string[];
  fallbackTargetSlugs?: string[];
  minTriggerBags: number;
  minTargetBags: number;
  triggerThresholdUnit?: string;
  targetThresholdUnit?: string;
  /** Legacy fallback when product size has no comboPriceWithGst */
  comboPriceInclGst?: number;
  suggestionMessage?: string;
};

type PreparedLine = {
  key: string;
  totalPackets: number;
  listBasic: number;
  listGst: number;
  /** From catalog size row — combo net rates for separate combo listings */
  comboBasicPrice?: number;
  comboPriceWithGst?: number;
  slug: string | null;
  orderMode: CartOrderMode;
  quantity: number;
  packetsPerBag: number;
  /** Packets per shipping carton for this line — for carton-based thresholds */
  packetsPerCarton: number;
};

/** Bags toward a threshold — master_bag uses bag count; packets mode uses packet total / packetsPerBag. */
function lineBagsTowardThreshold(pl: PreparedLine): number {
  const mode = normalizeOrderMode(pl.orderMode);
  const pb = Math.max(1, pl.packetsPerBag);
  const q = Math.max(0, pl.quantity);
  if (mode === "master_bag") return q;
  return pl.totalPackets / pb;
}

function resolvePacketsPerCarton(product: LeanProductForCombo | undefined, row: LeanCatalogSize | null): number {
  const pack = product?.packaging;
  const pcsCarton = pack?.pcsInCartoon;
  const pcsPacket =
    (typeof row?.pcsPerPacket === "number" && row.pcsPerPacket > 0
      ? row.pcsPerPacket
      : undefined) ??
    (typeof pack?.pcsPerPacket === "number" && pack.pcsPerPacket > 0 ? pack.pcsPerPacket : undefined) ??
    (typeof pack?.pcsInPacket === "number" && pack.pcsInPacket > 0 ? pack.pcsInPacket : undefined);
  if (typeof pcsCarton === "number" && pcsCarton > 0 && typeof pcsPacket === "number" && pcsPacket > 0) {
    return Math.max(1, pcsCarton / pcsPacket);
  }
  return 1;
}

/** Contribution of one cart line toward a threshold in the rule's chosen unit. */
function lineContributionInUnit(pl: PreparedLine, unit: ThresholdUnit): number {
  const pk = Math.max(0, pl.totalPackets);
  switch (unit) {
    case "packets":
      return pk;
    case "bags":
      return lineBagsTowardThreshold(pl);
    case "cartons":
      return pk / Math.max(1, pl.packetsPerCarton);
    default:
      return lineBagsTowardThreshold(pl);
  }
}

/** Display names for combo target slugs (cart upsell when trigger met, no target in cart). */
async function resolveTargetProductLabelsBySlug(
  slugs: string[]
): Promise<Map<string, string>> {
  const uniq = [...new Set(slugs.map((s) => normalizeSlugToken(s)))].filter(Boolean);
  const out = new Map<string, string>();
  if (uniq.length === 0) return out;
  const rows = await ProductModel.find({ slug: { $in: uniq } }).select("slug name").lean();
  for (const row of rows) {
    const slug = typeof row.slug === "string" ? row.slug.trim().toLowerCase() : "";
    if (!slug) continue;
    const name =
      typeof row.name === "string" && row.name.trim().length > 0 ? row.name.trim() : slug;
    out.set(slug, name);
  }
  for (const s of uniq) {
    if (!out.has(s)) out.set(s, s);
  }
  return out;
}

function resolveRuleTriggerUnit(r: LeanComboRule): ThresholdUnit {
  return parseThresholdUnit(r.triggerThresholdUnit, "bags");
}

function resolveRuleTargetUnit(r: LeanComboRule): ThresholdUnit {
  return parseThresholdUnit(r.targetThresholdUnit, "bags");
}

type PerRuleStats = {
  poolPackets: number;
  /** Sum in this rule's `triggerThresholdUnit` */
  triggerAmount: number;
  /** Sum in this rule's `targetThresholdUnit` */
  targetAmount: number;
  hasTriggerLine: boolean;
  hasTargetLine: boolean;
  targetPackets: number;
};

function emptyStats(): PerRuleStats {
  return {
    poolPackets: 0,
    triggerAmount: 0,
    targetAmount: 0,
    hasTriggerLine: false,
    hasTargetLine: false,
    targetPackets: 0,
  };
}

/**
 * First active rule (by DB order) whose targets match this slug and which is activated — used so one line maps to one pool.
 */
function pickRuleForTargetLine(
  slug: string | null,
  rules: LeanComboRule[],
  activatedById: Map<string, boolean>
): LeanComboRule | null {
  if (!slug) return null;
  for (const r of rules) {
    const id = r._id.toString();
    if (!activatedById.get(id)) continue;
    if (slugInList(slug, r.targetSlugs)) return r;
  }
  return null;
}

export async function resolveCartComboPricing(
  lines: IncomingCartLineForCombo[],
  productByMongoId: Map<string, LeanProductForCombo>,
  options?: ComputeComboPricingOptions
): Promise<ComboPricingResult> {
  const skipCombo = options?.skipComboAllocation === true;

  await connectDb();
  const ruleDocs = await ComboRuleModel.find({ isActive: true }).sort({ _id: 1 }).lean();
  const rules = (await expandManyComboRulesForRuntime(
    ruleDocs as unknown as Array<LeanComboRule & { triggerCategoryIds?: unknown; targetCategoryIds?: unknown }>
  )) as unknown as LeanComboRule[];

  const prepared: PreparedLine[] = [];

  for (const line of lines) {
    const mode = normalizeOrderMode(line.orderMode);
    const key = lineKey(line.mongoProductId, line.productId, line.size, line.sellerId ?? "", mode);
    const q = Math.max(0, Number(line.quantity) || 0);

    if (!line.mongoProductId) {
      const slug = resolveSlugForLine(line, undefined);
      const pb = Math.max(1, Number(line.qtyPerBag) || 1);
      const tp = Math.max(0, pricedPacketCount(line));
      prepared.push({
        key,
        totalPackets: tp,
        listBasic: line.basicPricePerUnit,
        listGst: line.pricePerUnit,
        slug,
        orderMode: mode,
        quantity: q,
        packetsPerBag: pb,
        packetsPerCarton: 1,
      });
      continue;
    }

    const product = productByMongoId.get(line.mongoProductId);
    if (!product) {
      const slug = resolveSlugForLine(line, undefined);
      const pb = Math.max(1, Number(line.qtyPerBag) || 1);
      const tp = Math.max(0, pricedPacketCount(line));
      prepared.push({
        key,
        totalPackets: tp,
        listBasic: line.basicPricePerUnit,
        listGst: line.pricePerUnit,
        slug,
        orderMode: mode,
        quantity: q,
        packetsPerBag: pb,
        packetsPerCarton: 1,
      });
      continue;
    }

    const sizes = resolveSizesForSeller(product, line.sellerId ?? "");
    const row = findSizeRow(sizes, line.size);
    const packetsPerBag = resolveDbPacketsPerBag(product, row, line.qtyPerBag);
    const packetsPerCarton = resolvePacketsPerCarton(product, row);
    const slug = resolveSlugForLine(line, product);
    const totalPackets = totalPacketsForLine(line, packetsPerBag);

    const listBasic = row?.basicPrice ?? product.pricing?.basicPrice ?? line.basicPricePerUnit;
    const listGst = row?.priceWithGst ?? product.pricing?.priceWithGst ?? line.pricePerUnit;
    const comboGst =
      typeof row?.comboPriceWithGst === "number" && Number.isFinite(row.comboPriceWithGst) && row.comboPriceWithGst > 0
        ? row.comboPriceWithGst
        : undefined;
    const comboBas =
      typeof row?.comboBasicPrice === "number" && Number.isFinite(row.comboBasicPrice) && row.comboBasicPrice > 0
        ? row.comboBasicPrice
        : undefined;

    prepared.push({
      key,
      totalPackets,
      listBasic,
      listGst,
      comboBasicPrice: comboBas,
      comboPriceWithGst: comboGst,
      slug,
      orderMode: mode,
      quantity: q,
      packetsPerBag,
      packetsPerCarton,
    });
  }

  const statsByRuleId = new Map<string, PerRuleStats>();
  for (const r of rules) {
    statsByRuleId.set(r._id.toString(), emptyStats());
  }

  // Per rule: trigger/target amounts use each rule's threshold units; pool stays in packets.
  for (const p of prepared) {
    const pk = Math.max(0, p.totalPackets);
    for (const r of rules) {
      const id = r._id.toString();
      const st = statsByRuleId.get(id)!;
      const trigUnit = resolveRuleTriggerUnit(r);
      const tgtUnit = resolveRuleTargetUnit(r);
      if (slugInList(p.slug, r.triggerSlugs)) {
        st.hasTriggerLine = true;
        st.poolPackets += pk;
        st.triggerAmount += lineContributionInUnit(p, trigUnit);
      }
      if (slugInList(p.slug, r.targetSlugs)) {
        st.hasTargetLine = true;
        st.targetPackets += pk;
        st.targetAmount += lineContributionInUnit(p, tgtUnit);
      }
    }
  }

  const activatedById = new Map<string, boolean>();
  for (const r of rules) {
    const id = r._id.toString();
    const st = statsByRuleId.get(id)!;
    const minTrig = resolveMinTriggerBags(r);
    const triggerMet = st.triggerAmount >= minTrig;
    /**
     * No minimum target amount: once the trigger threshold is met (and the cart guard has allowed
     * target lines), any target qty above zero is eligible. `minTargetBags` is only the max cap for
     * how much target amount receives combo rate (see targetComboRemaining).
     */
    const hasComboTargetQty = st.hasTargetLine && st.targetAmount > 1e-9;
    const activated = triggerMet && hasComboTargetQty;
    activatedById.set(id, activated);
  }

  const poolRemaining = new Map<string, number>();
  for (const r of rules) {
    const id = r._id.toString();
    const st = statsByRuleId.get(id)!;
    const active = activatedById.get(id) === true && !skipCombo;
    poolRemaining.set(id, active ? st.poolPackets : 0);
  }

  /** Max target-side packets that may receive combo rate (clips when target amount exceeds minTargetBags cap). */
  const targetComboRemaining = new Map<string, number>();
  for (const r of rules) {
    const id = r._id.toString();
    const st = statsByRuleId.get(id)!;
    if (!activatedById.get(id) || skipCombo) {
      targetComboRemaining.set(id, 0);
      continue;
    }
    /** `minTargetBags` = max target-side amount (same unit as stats) that may be combo-priced. */
    const capTgt = resolveMinTargetBags(r);
    const A = Math.max(0, st.targetAmount);
    // A <= cap → ratio 1 (all target packets eligible); A > cap (stale) → combo only on first cap-worth.
    const ratio = A <= 1e-9 ? 0 : Math.min(1, capTgt / A);
    targetComboRemaining.set(id, st.targetPackets * ratio);
  }

  let eligiblePacketTotal = 0;
  let corePacketTotal = 0;
  for (const r of rules) {
    const st = statsByRuleId.get(r._id.toString())!;
    eligiblePacketTotal += st.poolPackets;
    corePacketTotal += st.targetPackets;
  }

  const outLines: ComboPricingResultLine[] = [];
  let cartTotalInclGst = 0;
  let cartBasicTotal = 0;
  let comboMatchedCorePackets = 0;
  let comboSavingsInclGst = 0;

  for (const p of prepared) {
    const pk = Math.max(0, p.totalPackets);
    if (pk === 0) {
      outLines.push({
        key: p.key,
        pricedPacketCount: 0,
        basicPricePerUnit: p.listBasic,
        pricePerUnit: p.listGst,
        comboPricedPackets: 0,
        isComboApplied: false,
        comboSubtotalInclGst: 0,
      });
      continue;
    }

    const rule = skipCombo ? null : pickRuleForTargetLine(p.slug, rules, activatedById);
    if (rule) {
      const rid = rule._id.toString();
      const pool = poolRemaining.get(rid) ?? 0;
      const tgtRem = targetComboRemaining.get(rid) ?? 0;
      const covered = Math.min(pk, pool, tgtRem);
      poolRemaining.set(rid, Math.max(0, pool - covered));
      targetComboRemaining.set(rid, Math.max(0, tgtRem - covered));
      comboMatchedCorePackets += covered;

      const comboIncl =
        p.comboPriceWithGst != null && Number.isFinite(p.comboPriceWithGst) && p.comboPriceWithGst > 0
          ? Number(p.comboPriceWithGst)
          : rule.comboPriceInclGst != null && Number.isFinite(rule.comboPriceInclGst) && rule.comboPriceInclGst >= 0
            ? Number(rule.comboPriceInclGst)
            : p.listGst;
      const comboBasicUnit =
        p.comboBasicPrice != null && Number.isFinite(p.comboBasicPrice) && p.comboBasicPrice > 0
          ? Number(p.comboBasicPrice)
          : deriveComboBasicUnit(comboIncl, p.listBasic, p.listGst);
      const surplus = pk - covered;

      const lineInclTotal = covered * comboIncl + surplus * p.listGst;
      const lineBasicTotal = covered * comboBasicUnit + surplus * p.listBasic;

      if (covered > 0) {
        comboSavingsInclGst += covered * (p.listGst - comboIncl);
      }

      cartTotalInclGst += lineInclTotal;
      cartBasicTotal += lineBasicTotal;

      const forceCombo = covered > 0;
      const pricePerUnitOut = forceCombo && pk > 0 ? lineInclTotal / pk : p.listGst;
      const basicPricePerUnitOut = forceCombo && pk > 0 ? lineBasicTotal / pk : p.listBasic;

      outLines.push({
        key: p.key,
        pricedPacketCount: pk,
        basicPricePerUnit: roundMoney(basicPricePerUnitOut),
        pricePerUnit: roundMoney(pricePerUnitOut),
        comboPricedPackets: covered,
        isComboApplied: forceCombo,
        comboSubtotalInclGst: forceCombo ? roundMoney(covered * comboIncl) : 0,
      });
      continue;
    }

    cartTotalInclGst += p.listGst * pk;
    cartBasicTotal += p.listBasic * pk;
    outLines.push({
      key: p.key,
      pricedPacketCount: pk,
      basicPricePerUnit: p.listBasic,
      pricePerUnit: p.listGst,
      comboPricedPackets: 0,
      isComboApplied: false,
      comboSubtotalInclGst: 0,
    });
  }

  /**
   * Step 3 smart messaging: combo targets are separate listings (guard-blocked without trigger).
   * When trigger threshold is met but no target line exists, `comboEligibleTargets` carries PDP links;
   * we intentionally do not push a long duplicate sentence into `smartSuggestion`.
   */
  const upsellSlugSet = new Set<string>();
  if (!skipCombo) {
    for (const r of rules) {
      const st = statsByRuleId.get(r._id.toString())!;
      const minTrig = resolveMinTriggerBags(r);
      const triggerMet = st.triggerAmount >= minTrig;
      if (triggerMet && !st.hasTargetLine) {
        for (const s of r.targetSlugs) {
          const k = normalizeSlugToken(s);
          if (k) upsellSlugSet.add(k);
        }
      }
    }
  }
  /** Fallback PDP links when trigger threshold is not yet met (rule `fallbackTargetSlugs`). */
  const fallbackUpsellSlugSet = new Set<string>();
  if (!skipCombo) {
    for (const r of rules) {
      const st = statsByRuleId.get(r._id.toString())!;
      const minTrig = resolveMinTriggerBags(r);
      const triggerMet = st.triggerAmount >= minTrig;
      if (st.hasTriggerLine && !triggerMet) {
        // Swap targets shown in cart when combo condition drops:
        // prefer explicit fallback targets, otherwise show rule targets as fallback options.
        const fallbackSource =
          Array.isArray(r.fallbackTargetSlugs) && r.fallbackTargetSlugs.length > 0
            ? r.fallbackTargetSlugs
            : r.targetSlugs;
        for (const s of fallbackSource) {
          const k = normalizeSlugToken(s);
          if (k) fallbackUpsellSlugSet.add(k);
        }
      }
    }
  }

  /** Resolve display names for every rule’s combo targets (used in banners before unlock too). */
  const allRuleTargetLabelSlugs = new Set<string>();
  if (!skipCombo) {
    for (const r of rules) {
      for (const s of r.targetSlugs) {
        const k = normalizeSlugToken(s);
        if (k) allRuleTargetLabelSlugs.add(k);
      }
    }
  }
  for (const s of fallbackUpsellSlugSet) {
    allRuleTargetLabelSlugs.add(s);
  }
  const targetLabelBySlug =
    !skipCombo && allRuleTargetLabelSlugs.size > 0
      ? await resolveTargetProductLabelsBySlug([...allRuleTargetLabelSlugs])
      : new Map<string, string>();

  function comboTargetNamesPhrase(slugs: string[]): string {
    const parts = slugs
      .map((s) => normalizeSlugToken(s))
      .filter(Boolean)
      .map((slug) => targetLabelBySlug.get(slug) ?? slug);
    const uniq = [...new Set(parts)];
    if (uniq.length === 0) return "";
    return uniq.join(", ");
  }

  const comboEligibleTargets =
    !skipCombo && upsellSlugSet.size > 0
      ? [...upsellSlugSet].sort().map((slug) => ({
        slug,
        name: targetLabelBySlug.get(slug) ?? slug,
      }))
      : undefined;
  const comboFallbackTargets =
    !skipCombo && fallbackUpsellSlugSet.size > 0
      ? [...fallbackUpsellSlugSet].map((slug) => ({
        slug,
        name: targetLabelBySlug.get(slug) ?? slug,
      }))
      : undefined;
  const comboSwapTargetSlugs =
    !skipCombo
      ? (() => {
          const bad = new Set<string>();
          for (const r of rules) {
            const st = statsByRuleId.get(r._id.toString())!;
            const minTrig = resolveMinTriggerBags(r);
            const triggerMet = st.triggerAmount >= minTrig;
            if (triggerMet || !st.hasTriggerLine || !st.hasTargetLine) continue;
            for (const s of r.targetSlugs) {
              const k = normalizeSlugToken(s);
              if (k) bad.add(k);
            }
          }
          return bad.size > 0 ? [...bad] : undefined;
        })()
      : undefined;
  const comboRemoveWhenNoTriggerSlugs =
    !skipCombo
      ? (() => {
          const toRemove = new Set<string>();
          for (const r of rules) {
            const st = statsByRuleId.get(r._id.toString())!;
            if (st.hasTriggerLine) continue;
            for (const s of r.targetSlugs) {
              const k = normalizeSlugToken(s);
              if (k) toRemove.add(k);
            }
          }
          return toRemove.size > 0 ? [...toRemove] : undefined;
        })()
      : undefined;

  const suggestionParts: string[] = [];
  if (!skipCombo) {
    for (const r of rules) {
      const st = statsByRuleId.get(r._id.toString())!;
      const minTrig = resolveMinTriggerBags(r);
      const capTgt = resolveMinTargetBags(r);
      const trigUnit = resolveRuleTriggerUnit(r);
      const triggerMet = st.triggerAmount >= minTrig;

      // 1) No trigger in cart — do not show combo messaging for unrelated products.
      if (!st.hasTriggerLine) {
        continue;
      }

      // 2) Some trigger, but below threshold — say how much more trigger is needed and which target(s) unlock next.
      if (!triggerMet) {
        const triggerDiff = bagsRemainingToThreshold(minTrig, st.triggerAmount);
        const triggerDiffLabel = formatCountWithUnit(triggerDiff, trigUnit);
        const targets = comboTargetNamesPhrase(r.targetSlugs);
        const tail =
          targets.length > 0
            ? ` Then add combo target: ${targets} (opens combo net pricing in cart).`
            : "";
        suggestionParts.push(`Add ${triggerDiffLabel} more to unlock combo.${tail}`);
        continue;
      }

      // 3) Trigger threshold met and no combo target line — no `smartSuggestion` copy here (avoids duplicate
      // long line); `comboEligibleTargets` still lists slugs/names for cart UI (links / offer popup).
      if (triggerMet && !st.hasTargetLine) {
        continue;
      }

      // 4) Stale cart: target amount over max cap — pricing clips; point to listing (no "add more" at list price).
      if (st.hasTargetLine && st.targetAmount > capTgt + 1e-6) {
        suggestionParts.push(
          "Finish this offer on the combo 20mm product page — it is listed separately from standard clamps."
        );
        continue;
      }
    }
  }

  const smartSuggestion =
    suggestionParts.length > 0 ? [...new Set(suggestionParts)].join(" ") : null;

  return {
    lines: outLines,
    eligiblePacketTotal,
    corePacketTotal,
    comboMatchedCorePackets,
    cartTotalInclGst: roundMoney(cartTotalInclGst),
    cartBasicTotal: roundMoney(cartBasicTotal),
    comboSavingsInclGst: roundMoney(Math.max(0, comboSavingsInclGst)),
    smartSuggestion,
    comboEligibleTargets,
    comboFallbackTargets,
    comboSwapTargetSlugs,
    comboRemoveWhenNoTriggerSlugs,
  };
}
