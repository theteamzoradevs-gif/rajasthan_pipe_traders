/**
 * Coupon tier thresholds use `minPackets` on each tier row. This module converts cart lines to a
 * consistent packet count and (when `tierUnit === "outer"`) to outer units (cartons / master bags /
 * priced cartons from Mongo) using `packaging` + `pricingUnit` and list price math.
 */

import { normalizeOrderMode, type CartOrderMode } from "@/lib/cart/packetLine";

export type PackagingFields = {
  pricingUnit?: string;
  pcsPerPacket?: number;
  pcsInCartoon?: number;
  pcsPerBox?: number;
  /** When set, boxes per master carton (catalog field). */
  boxesInMasterCartoon?: number;
  packetsInMasterBag?: number;
  pktInMasterBag?: number;
};

export type SizeRowFields = {
  qtyPerBag?: number;
  pcsPerPacket?: number;
};

export type ProductPackagingForCoupon = {
  pricingUnit: string;
  packaging: PackagingFields;
  sizeRow?: SizeRowFields;
};

function num(n: unknown): number | undefined {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string" && n.trim() !== "" && Number.isFinite(Number(n))) return Number(n);
  return undefined;
}

function findSizeRow<T extends { size: string }>(
  rows: T[] | undefined,
  size: string | undefined
): T | undefined {
  if (!rows?.length) return undefined;
  const t = (size ?? "").trim();
  if (!t) return rows[0];
  const exact = rows.find((s) => s.size === t);
  if (exact) return exact;
  const tl = t.toLowerCase();
  return rows.find((s) => s.size.trim().toLowerCase() === tl) ?? rows[0];
}

type LeanProductForPackaging = {
  packaging?: PackagingFields;
  sellers?: Array<{ sellerId: string; sizes?: Array<Record<string, unknown>> }>;
  sizes?: Array<Record<string, unknown>>;
};

/**
 * Reads packaging + the active size row (qtyPerBag, pcsPerPacket) from a product document.
 */
export function buildPackagingContextFromProduct(
  prod: LeanProductForPackaging,
  sellerId: string | undefined,
  size: string | undefined
): ProductPackagingForCoupon {
  const pack = prod.packaging ?? {};
  const sid = (sellerId ?? "").trim();
  let row: Record<string, unknown> | undefined;

  if (prod.sellers && prod.sellers.length > 0) {
    const offer =
      (sid ? prod.sellers.find((s) => s.sellerId === sid) : undefined) ?? prod.sellers[0];
    if (offer?.sizes && offer.sizes.length > 0) {
      row = findSizeRow(
        offer.sizes as Array<{ size: string } & Record<string, unknown>>,
        size
      ) as Record<string, unknown> | undefined;
    }
  }
  if (!row && prod.sizes && prod.sizes.length > 0) {
    row = findSizeRow(
      prod.sizes as Array<{ size: string } & Record<string, unknown>>,
      size
    ) as Record<string, unknown> | undefined;
  }

  const pricingUnit = typeof pack.pricingUnit === "string" && pack.pricingUnit ? pack.pricingUnit : "per_packet";

  return {
    pricingUnit,
    packaging: {
      pcsPerPacket: num(pack.pcsPerPacket),
      pcsInCartoon: num(pack.pcsInCartoon),
      pcsPerBox: num(pack.pcsPerBox),
      boxesInMasterCartoon: num(pack.boxesInMasterCartoon),
      packetsInMasterBag: num(pack.packetsInMasterBag),
      pktInMasterBag: num(pack.pktInMasterBag),
    },
    sizeRow: row
      ? {
          qtyPerBag: num(row.qtyPerBag),
          pcsPerPacket: num(row.pcsPerPacket),
        }
      : undefined,
  };
}

function pcsToPackets(pcs: number | undefined, pcsPerPacket: number | undefined): number {
  if (!pcs || pcs <= 0 || !pcsPerPacket || pcsPerPacket <= 0) return 0;
  return Math.max(1, Math.ceil(pcs / pcsPerPacket));
}

/**
 * Converts purchased “pricing units” (packets, cartons, boxes, bags, …) into packet count for tier math.
 */
export function computeCouponTierPacketCount(args: {
  lineSubtotalInclGst: number;
  unitPriceWithGst: number;
  product: ProductPackagingForCoupon | null;
  /** Cart / client: priced packet equivalent (packets, or bags × qtyPerBag) */
  clientPacketQuantity: number;
}): number {
  const { lineSubtotalInclGst, unitPriceWithGst, product, clientPacketQuantity } = args;
  const fallback = Math.max(0, Math.floor(clientPacketQuantity + 1e-9));
  if (lineSubtotalInclGst <= 0 || unitPriceWithGst <= 0) return fallback;

  const pack = product?.packaging ?? {};
  const sr = product?.sizeRow ?? {};
  const ppp = num(sr.pcsPerPacket) ?? num(pack.pcsPerPacket) ?? 0;

  const pu = (product?.pricingUnit ?? "per_packet") as string;
  const unitsPurchased = lineSubtotalInclGst / unitPriceWithGst;

  if (pu === "per_packet" || pu === "per_piece") {
    return Math.max(0, Math.floor(unitsPurchased + 1e-9));
  }

  if (pu === "per_cartoon") {
    const pktPerCarton = pcsToPackets(num(pack.pcsInCartoon), ppp);
    if (pktPerCarton <= 0) return fallback;
    const cartons = Math.max(0, Math.floor(unitsPurchased + 1e-9));
    return cartons * pktPerCarton;
  }

  if (pu === "per_box") {
    const pktPerBox = pcsToPackets(num(pack.pcsPerBox), ppp);
    if (pktPerBox <= 0) return fallback;
    const boxes = Math.max(0, Math.floor(unitsPurchased + 1e-9));
    return boxes * pktPerBox;
  }

  if (pu === "per_bag" || pu === "per_master_bag") {
    const pkt =
      num(sr.qtyPerBag) ?? num(pack.packetsInMasterBag) ?? num(pack.pktInMasterBag) ?? 0;
    if (pkt <= 0) return fallback;
    const outers = Math.max(0, Math.floor(unitsPurchased + 1e-9));
    return outers * pkt;
  }

  if (pu === "per_dozen") {
    const dozens = Math.max(0, Math.floor(unitsPurchased + 1e-9));
    if (ppp > 0) {
      return Math.max(0, Math.floor((dozens * 12) / ppp + 1e-9));
    }
    return Math.max(0, dozens * 12);
  }

  return fallback;
}

/** Boxes inside one carton — used when mixed carts count boxes like packets for packet-tier coupons. */
export function boxesPerCartonFromPackaging(pack: PackagingFields, pcsPerPacketForPkt: number): number {
  const boxed = num(pack.boxesInMasterCartoon);
  if (boxed != null && boxed > 0) return Math.max(1, Math.floor(boxed + 1e-9));
  const pcsCart = num(pack.pcsInCartoon);
  const pcsBox = num(pack.pcsPerBox);
  if (pcsCart && pcsCart > 0 && pcsBox && pcsBox > 0) {
    return Math.max(1, Math.ceil(pcsCart / pcsBox));
  }
  const ppp = num(pack.pcsPerPacket) ?? pcsPerPacketForPkt;
  const pktPerCarton = pcsToPackets(num(pack.pcsInCartoon), ppp);
  return Math.max(1, pktPerCarton);
}

export type LinePricingFamily = "packet" | "outerish" | "unknown";

/** Classify a line for mixed-cart detection (packet-priced vs carton/bag/box pricing). */
export function linePricingFamilyFromPackaging(
  product: ProductPackagingForCoupon | null,
  orderMode?: CartOrderMode
): LinePricingFamily {
  if (normalizeOrderMode(orderMode) === "master_bag") return "outerish";
  if (!product) return "unknown";
  const pu = String(product.pricingUnit ?? "per_packet")
    .trim()
    .toLowerCase();
  if (pu === "per_packet" || pu === "per_piece" || pu === "per_dozen") return "packet";
  if (
    pu === "per_cartoon" ||
    pu === "per_box" ||
    pu === "per_bag" ||
    pu === "per_master_bag"
  ) {
    return "outerish";
  }
  return "unknown";
}

/**
 * True when the cart mixes packet-style lines with carton/bag/box-style lines — packet-tier thresholds
 * then use packets + boxes as one pool (bags still expand to inner packets).
 */
export function cartHasMixedPacketAndOuterFamilies(
  lines: Array<{ product: ProductPackagingForCoupon | null; orderMode?: CartOrderMode }>
): boolean {
  let hasPacket = false;
  let hasOuter = false;
  for (const l of lines) {
    const f = linePricingFamilyFromPackaging(l.product, l.orderMode);
    if (f === "packet") hasPacket = true;
    if (f === "outerish") hasOuter = true;
  }
  return hasPacket && hasOuter;
}

/**
 * Packet-tier `minPackets` count when the cart is mixed: actual packets on packet lines; on carton
 * lines total **boxes** (cartons × boxes/carton), counting each box like one packet; bags use inner packets.
 */
export function computeCouponTierPacketCountMixedCartLine(args: {
  lineSubtotalInclGst: number;
  unitPriceWithGst: number;
  product: ProductPackagingForCoupon | null;
  clientPacketQuantity: number;
  orderMode?: CartOrderMode;
}): number {
  const { lineSubtotalInclGst, unitPriceWithGst, product, clientPacketQuantity, orderMode } = args;
  if (normalizeOrderMode(orderMode) === "master_bag") {
    return computeCouponTierPacketCount({
      lineSubtotalInclGst,
      unitPriceWithGst,
      product,
      clientPacketQuantity,
    });
  }
  const fallback = Math.max(0, Math.floor(clientPacketQuantity + 1e-9));
  if (!product || lineSubtotalInclGst <= 0 || unitPriceWithGst <= 0) return fallback;

  const pack = product.packaging ?? {};
  const sr = product.sizeRow ?? {};
  const ppp = num(sr.pcsPerPacket) ?? num(pack.pcsPerPacket) ?? 0;
  const pu = (product.pricingUnit ?? "per_packet") as string;
  const unitsPurchased = lineSubtotalInclGst / unitPriceWithGst;

  if (pu === "per_packet" || pu === "per_piece") {
    return Math.max(0, Math.floor(unitsPurchased + 1e-9));
  }

  if (pu === "per_box") {
    return Math.max(0, Math.floor(unitsPurchased + 1e-9));
  }

  if (pu === "per_cartoon") {
    const cartons = Math.max(0, Math.floor(unitsPurchased + 1e-9));
    const bpc = boxesPerCartonFromPackaging(pack, ppp);
    return cartons * bpc;
  }

  if (pu === "per_bag" || pu === "per_master_bag") {
    return computeCouponTierPacketCount({
      lineSubtotalInclGst,
      unitPriceWithGst,
      product,
      clientPacketQuantity,
    });
  }

  if (pu === "per_dozen") {
    const dozens = Math.max(0, Math.floor(unitsPurchased + 1e-9));
    if (ppp > 0) {
      return Math.max(0, Math.floor((dozens * 12) / ppp + 1e-9));
    }
    return Math.max(0, dozens * 12);
  }

  return fallback;
}

function outerUnitsFromPacketCount(pkt: number, product: ProductPackagingForCoupon | null): number {
  const p = Math.max(0, Math.floor(pkt + 1e-9));
  if (!product) return p;
  const pack = product.packaging ?? {};
  const sr = product.sizeRow ?? {};
  const ppp = num(sr.pcsPerPacket) ?? num(pack.pcsPerPacket) ?? 0;
  const pcsInCartoon = num(pack.pcsInCartoon);
  if (pcsInCartoon && pcsInCartoon > 0 && ppp > 0) {
    const pktPerCarton = Math.max(1, Math.ceil(pcsInCartoon / ppp));
    return Math.max(0, Math.floor(p / pktPerCarton + 1e-9));
  }
  const qtyPerBag = num(sr.qtyPerBag) ?? num(pack.packetsInMasterBag) ?? num(pack.pktInMasterBag) ?? 0;
  if (qtyPerBag > 0) {
    return Math.max(0, Math.floor(p / qtyPerBag + 1e-9));
  }
  return p;
}

/**
 * Outer units for tier thresholds: one master bag = 1; packet lines → cartons when carton size is
 * known, else master-bag equivalents; Mongo `per_cartoon` / `per_bag` pricing uses priced units
 * from line subtotal / unit price.
 */
export function computeCouponTierOuterUnitCount(args: {
  lineSubtotalInclGst: number;
  unitPriceWithGst: number;
  product: ProductPackagingForCoupon | null;
  /** Priced packet equivalent (bags × qtyPerBag in packet mode). */
  clientPacketQuantity: number;
  orderMode?: CartOrderMode;
  /** Cart `quantity`: packets when `orderMode` is packets, bag count when `master_bag`. */
  rawLineQuantity?: number;
}): number {
  const {
    lineSubtotalInclGst,
    unitPriceWithGst,
    product,
    clientPacketQuantity,
    orderMode,
    rawLineQuantity,
  } = args;
  const mode = normalizeOrderMode(orderMode);

  if (mode === "master_bag") {
    const pktPerBag =
      num(product?.sizeRow?.qtyPerBag) ??
      num(product?.packaging?.packetsInMasterBag) ??
      num(product?.packaging?.pktInMasterBag) ??
      0;
    if (rawLineQuantity != null && Number.isFinite(Number(rawLineQuantity))) {
      return Math.max(0, Math.floor(Number(rawLineQuantity) + 1e-9));
    }
    if (pktPerBag > 0) {
      const pk = Math.max(0, Math.floor(clientPacketQuantity + 1e-9));
      return Math.max(0, Math.floor(pk / pktPerBag + 1e-9));
    }
    return Math.max(0, Math.floor(clientPacketQuantity + 1e-9));
  }

  const pk = Math.max(0, Math.floor(clientPacketQuantity + 1e-9));
  if (lineSubtotalInclGst <= 0 || unitPriceWithGst <= 0) {
    return outerUnitsFromPacketCount(pk, product);
  }

  const pu = (product?.pricingUnit ?? "per_packet") as string;
  const unitsPurchased = lineSubtotalInclGst / unitPriceWithGst;

  if (pu === "per_cartoon" || pu === "per_box") {
    return Math.max(0, Math.floor(unitsPurchased + 1e-9));
  }
  if (pu === "per_bag" || pu === "per_master_bag") {
    return Math.max(0, Math.floor(unitsPurchased + 1e-9));
  }
  if (pu === "per_dozen") {
    return Math.max(0, Math.floor(unitsPurchased + 1e-9));
  }

  if (pu === "per_packet" || pu === "per_piece") {
    return outerUnitsFromPacketCount(pk, product);
  }

  return outerUnitsFromPacketCount(pk, product);
}
