export type CartOrderMode = "packets" | "master_bag";

/** Minimal fields for per-packet pricing (matches `CartItem`). */
export interface CartLineForPricing {
  orderMode?: CartOrderMode;
  quantity: number;
  qtyPerBag: number;
  pcsPerPacket: number;
}

export function normalizeOrderMode(mode: CartLineForPricing["orderMode"]): CartOrderMode {
  return mode === "master_bag" ? "master_bag" : "packets";
}

/** Packets priced at `pricePerUnit` (per packet). For master-bag lines, `quantity` is bag count. */
export function pricedPacketCount(item: CartLineForPricing): number {
  if (normalizeOrderMode(item.orderMode) === "master_bag") {
    const bags = Number(item.quantity) || 0;
    const pktsPerBag = Number(item.qtyPerBag) || 0;
    return bags * pktsPerBag;
  }
  return Number(item.quantity) || 0;
}

export function totalPiecesForLine(item: CartLineForPricing): number {
  const pkts = pricedPacketCount(item);
  const ppp = Number(item.pcsPerPacket) || 0;
  return pkts * ppp;
}

/**
 * When `qtyPerBag` > 0, UI "packet" steps are in master-bag units: each step adds `qtyPerBag` packets
 * (same MOQ as one outer bag).
 */
export function packetsFromMoqSteps(steps: number, qtyPerBag: number): number {
  const qpb = Math.max(0, Math.floor(Number(qtyPerBag) || 0));
  const s = Math.max(0, Math.floor(Number(steps) || 0));
  if (qpb <= 0) return s;
  return s * qpb;
}

/** Packet-line quantity → whole MOQ steps (floor). */
export function moqStepsFromPacketQty(pktQty: number, qtyPerBag: number): number {
  const qpb = Math.max(0, Math.floor(Number(qtyPerBag) || 0));
  if (qpb <= 0) return Math.max(0, Math.floor(Number(pktQty) || 0));
  const pk = Math.max(0, Math.floor(Number(pktQty) || 0));
  return Math.floor(pk / qpb + 1e-9);
}
