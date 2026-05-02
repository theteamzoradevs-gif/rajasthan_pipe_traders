import mongoose from "mongoose";
import { ProductModel } from "@/lib/db/models/Product";
import { normalizeOrderMode } from "@/lib/cart/packetLine";
import {
  buildPackagingContextFromProduct,
  cartHasMixedPacketAndOuterFamilies,
  computeCouponTierOuterUnitCount,
  computeCouponTierPacketCount,
  computeCouponTierPacketCountMixedCartLine,
  type ProductPackagingForCoupon,
} from "@/lib/coupons/couponTierQuantity";
import type { CartOrderMode } from "@/lib/cart/packetLine";
import type { CartLineInput } from "./evaluate";

/** Matches `cartCoupons.ts` — carton/box/bag list units compete with outer-tier coupons. */
const OUTER_PRICING_UNITS = new Set([
  "per_cartoon",
  "per_box",
  "per_bag",
  "per_master_bag",
]);

export type IncomingCouponLine = {
  productMongoId?: string;
  /** Storefront numeric product id — matches MongoDB `legacyId` when catalog products lack mongo id on the client */
  legacyProductId?: number;
  categoryMongoId?: string;
  sellerId?: string;
  size?: string;
  quantity: number;
  /** Client-computed GST-inclusive line total (authoritative when present) */
  lineSubtotal?: number;
  lineBasicSubtotal?: number;
  /** GST-inclusive combo net portion — excluded from coupon discount */
  comboSubtotalInclGst?: number;
  /** Matches cart line — used with `rawQuantity` for outer-unit tier math */
  orderMode?: CartOrderMode;
  /**
   * Cart `quantity` before priced-packet expansion: packet count in `packets` mode, bag count in
   * `master_bag` mode. When omitted, outer tiers infer bags from packets ÷ qtyPerBag when possible.
   */
  rawQuantity?: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function findSizeRow<T extends { size: string }>(rows: T[] | undefined, size: string | undefined): T | undefined {
  if (!rows?.length) return undefined;
  const t = (size ?? "").trim();
  if (!t) return rows[0];
  const exact = rows.find((s) => s.size === t);
  if (exact) return exact;
  const tl = t.toLowerCase();
  return rows.find((s) => s.size.trim().toLowerCase() === tl) ?? rows[0];
}

type LeanProduct = {
  _id: unknown;
  isActive?: boolean;
  category?: unknown;
  packaging?: Record<string, unknown>;
  sellers?: Array<{
    sellerId: string;
    sizes?: Array<{ size: string; basicPrice: number; priceWithGst: number }>;
  }>;
  sizes?: Array<{ size: string; basicPrice: number; priceWithGst: number }>;
  pricing?: { basicPrice: number; priceWithGst: number };
};

function pickUnitPrice(
  prod: LeanProduct,
  sellerId: string | undefined,
  size: string | undefined
): { basicPrice: number; priceWithGst: number } | null {
  const sid = (sellerId ?? "").trim();

  if (prod.sellers && prod.sellers.length > 0) {
    const offer =
      (sid ? prod.sellers.find((s) => s.sellerId === sid) : undefined) ?? prod.sellers[0];
    if (offer?.sizes && offer.sizes.length > 0) {
      const row = findSizeRow(offer.sizes, size);
      if (row) return { basicPrice: row.basicPrice, priceWithGst: row.priceWithGst };
    }
  }

  if (prod.sizes && prod.sizes.length > 0) {
    const row = findSizeRow(prod.sizes, size);
    if (row) return { basicPrice: row.basicPrice, priceWithGst: row.priceWithGst };
  }

  if (prod.pricing?.priceWithGst != null && prod.pricing?.basicPrice != null) {
    return { basicPrice: prod.pricing.basicPrice, priceWithGst: prod.pricing.priceWithGst };
  }

  return null;
}

type MongoLineWork = {
  pid: string;
  row: IncomingCouponLine;
  q: number;
  lineSubtotal: number;
  lineBasicSubtotal: number;
  categoryMongoId?: string;
  comboSt?: number;
  pkgCtx: ProductPackagingForCoupon;
  unit: { basicPrice: number; priceWithGst: number };
};

/**
 * Builds canonical cart lines: when `productMongoId` is present, GST-inclusive totals come from
 * the database (authoritative). Otherwise client totals are used (legacy/static catalog).
 */
function computePreferOuterTierCoupons(
  prepared: IncomingCouponLine[],
  mongoWorks: MongoLineWork[]
): boolean {
  for (const row of prepared) {
    if (normalizeOrderMode(row.orderMode) === "master_bag") return true;
  }
  for (const m of mongoWorks) {
    const pu = String(m.pkgCtx.pricingUnit ?? "per_packet").trim().toLowerCase();
    if (OUTER_PRICING_UNITS.has(pu)) return true;
  }
  return false;
}

export async function resolveCartLinesForCoupon(
  raw: IncomingCouponLine[]
): Promise<
  | { ok: true; lines: CartLineInput[]; cartSubtotalInclGst: number; preferOuterTierCoupons: boolean }
  | { ok: false; reason: string }
> {
  if (!raw.length) {
    return { ok: false, reason: "Cart is empty" };
  }

  const prepared: IncomingCouponLine[] = [];
  for (const row of raw) {
    const q = typeof row.quantity === "number" ? row.quantity : Number(row.quantity);
    if (!Number.isFinite(q) || q <= 0) continue;
    prepared.push(row);
  }
  if (!prepared.length) {
    return { ok: false, reason: "Cart is empty" };
  }

  const idStrings: string[] = [];
  const legacyIds = new Set<number>();
  for (const row of prepared) {
    const pid = row.productMongoId?.trim();
    if (pid && mongoose.Types.ObjectId.isValid(pid)) {
      idStrings.push(pid);
    } else {
      const lid =
        row.legacyProductId !== undefined
          ? typeof row.legacyProductId === "number"
            ? row.legacyProductId
            : Number(row.legacyProductId)
          : NaN;
      if (Number.isFinite(lid) && lid > 0) legacyIds.add(Math.floor(lid));
    }
  }

  const uniqueIds = [...new Set(idStrings)];
  const [byOidRows, byLegacyRows] = await Promise.all([
    uniqueIds.length > 0
      ? ProductModel.find({ _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .select({ sellers: 1, sizes: 1, pricing: 1, category: 1, isActive: 1, legacyId: 1, packaging: 1 })
          .lean()
      : Promise.resolve([]),
    legacyIds.size > 0
      ? ProductModel.find({ legacyId: { $in: [...legacyIds] } })
          .select({ sellers: 1, sizes: 1, pricing: 1, category: 1, isActive: 1, legacyId: 1, packaging: 1 })
          .lean()
      : Promise.resolve([]),
  ]);

  const byId = new Map<string, LeanProduct>();
  for (const p of [...byOidRows, ...byLegacyRows]) {
    byId.set(String(p._id), p as LeanProduct);
  }

  const byLegacy = new Map<number, LeanProduct>();
  for (const p of byLegacyRows) {
    if (p.legacyId != null) byLegacy.set(Number(p.legacyId), p as LeanProduct);
  }

  type Segment = { kind: "mongo"; work: MongoLineWork } | { kind: "legacy"; line: CartLineInput };

  const segments: Segment[] = [];
  let cartSubtotalInclGst = 0;

  for (const row of prepared) {
    let pid = row.productMongoId?.trim();
    const q = typeof row.quantity === "number" ? row.quantity : Number(row.quantity);

    if (!pid || !mongoose.Types.ObjectId.isValid(pid)) {
      const lid =
        row.legacyProductId !== undefined
          ? typeof row.legacyProductId === "number"
            ? row.legacyProductId
            : Number(row.legacyProductId)
          : NaN;
      if (Number.isFinite(lid) && lid > 0) {
        const lp = byLegacy.get(Math.floor(lid));
        if (lp) pid = String(lp._id);
      }
    }

    if (pid && mongoose.Types.ObjectId.isValid(pid)) {
      const prod = byId.get(pid);
      if (!prod) {
        return { ok: false, reason: "One or more products are no longer available" };
      }
      if (prod.isActive === false) {
        return { ok: false, reason: "One or more products in your cart are no longer available" };
      }
      const unit = pickUnitPrice(prod, row.sellerId, row.size);
      if (!unit) {
        return {
          ok: false,
          reason: "Could not resolve price for a cart item — try refreshing the page",
        };
      }
      const clientSt =
        row.lineSubtotal != null && Number.isFinite(Number(row.lineSubtotal))
          ? roundMoney(Number(row.lineSubtotal))
          : null;
      const lineSubtotal =
        clientSt != null && clientSt >= 0 ? clientSt : roundMoney(unit.priceWithGst * q);
      const lineBasicSubtotal =
        row.lineBasicSubtotal != null && Number.isFinite(Number(row.lineBasicSubtotal))
          ? roundMoney(Number(row.lineBasicSubtotal))
          : roundMoney(unit.basicPrice * q);
      const categoryMongoId =
        prod.category != null ? String(prod.category) : row.categoryMongoId?.trim();
      const comboSt =
        row.comboSubtotalInclGst != null && Number.isFinite(Number(row.comboSubtotalInclGst))
          ? roundMoney(Math.max(0, Number(row.comboSubtotalInclGst)))
          : undefined;
      const pkgCtx = buildPackagingContextFromProduct(prod as Parameters<typeof buildPackagingContextFromProduct>[0], row.sellerId, row.size);
      cartSubtotalInclGst += lineSubtotal;
      segments.push({
        kind: "mongo",
        work: {
          pid,
          row,
          q,
          lineSubtotal,
          lineBasicSubtotal,
          categoryMongoId,
          comboSt,
          pkgCtx,
          unit,
        },
      });
    } else {
      const st = row.lineSubtotal != null ? Number(row.lineSubtotal) : NaN;
      if (!Number.isFinite(st) || st < 0) {
        return { ok: false, reason: "Invalid line total for a cart item" };
      }
      const basic =
        row.lineBasicSubtotal != null && Number.isFinite(Number(row.lineBasicSubtotal))
          ? roundMoney(Number(row.lineBasicSubtotal))
          : undefined;
      const comboSt =
        row.comboSubtotalInclGst != null && Number.isFinite(Number(row.comboSubtotalInclGst))
          ? roundMoney(Math.max(0, Number(row.comboSubtotalInclGst)))
          : undefined;
      cartSubtotalInclGst += st;
      const line: CartLineInput = {
        productMongoId: undefined,
        categoryMongoId: row.categoryMongoId?.trim(),
        quantity: q,
        lineSubtotal: st,
        lineBasicSubtotal: basic,
        ...(comboSt !== undefined && comboSt > 0 ? { comboSubtotalInclGst: comboSt } : {}),
      };
      segments.push({ kind: "legacy", line });
    }
  }

  const mongoWorks = segments.filter((s): s is { kind: "mongo"; work: MongoLineWork } => s.kind === "mongo").map(
    (s) => s.work
  );
  const mixedPacketTier =
    mongoWorks.length >= 2 &&
    cartHasMixedPacketAndOuterFamilies(
      mongoWorks.map((m) => ({ product: m.pkgCtx, orderMode: m.row.orderMode }))
    );

  const lines: CartLineInput[] = [];
  for (const seg of segments) {
    if (seg.kind === "legacy") {
      lines.push(seg.line);
      continue;
    }
    const m = seg.work;
    const tierPackets = mixedPacketTier
      ? computeCouponTierPacketCountMixedCartLine({
          lineSubtotalInclGst: m.lineSubtotal,
          unitPriceWithGst: m.unit.priceWithGst,
          product: m.pkgCtx,
          clientPacketQuantity: m.q,
          orderMode: m.row.orderMode,
        })
      : computeCouponTierPacketCount({
          lineSubtotalInclGst: m.lineSubtotal,
          unitPriceWithGst: m.unit.priceWithGst,
          product: m.pkgCtx,
          clientPacketQuantity: m.q,
        });
    const tierOuter = computeCouponTierOuterUnitCount({
      lineSubtotalInclGst: m.lineSubtotal,
      unitPriceWithGst: m.unit.priceWithGst,
      product: m.pkgCtx,
      clientPacketQuantity: m.q,
      orderMode: m.row.orderMode,
      rawLineQuantity: m.row.rawQuantity,
    });
    lines.push({
      productMongoId: m.pid,
      categoryMongoId: m.categoryMongoId,
      quantity: m.q,
      tierPacketQuantity: tierPackets,
      tierOuterUnitQuantity: tierOuter,
      lineSubtotal: m.lineSubtotal,
      lineBasicSubtotal: m.lineBasicSubtotal,
      ...(m.comboSt !== undefined && m.comboSt > 0 ? { comboSubtotalInclGst: m.comboSt } : {}),
    });
  }

  cartSubtotalInclGst = roundMoney(cartSubtotalInclGst);
  const preferOuterTierCoupons = computePreferOuterTierCoupons(prepared, mongoWorks);
  return { ok: true, lines, cartSubtotalInclGst, preferOuterTierCoupons };
}
