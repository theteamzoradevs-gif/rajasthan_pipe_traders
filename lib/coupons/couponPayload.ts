import mongoose from "mongoose";

export function parseObjectIdList(v: unknown): mongoose.Types.ObjectId[] {
  if (v == null) return [];
  const parts: string[] = [];
  if (Array.isArray(v)) {
    for (const x of v) {
      if (typeof x === "string" && x.trim()) parts.push(x.trim());
    }
  } else if (typeof v === "string") {
    for (const s of v.split(/[\s,]+/)) {
      if (s.trim()) parts.push(s.trim());
    }
  }
  const out: mongoose.Types.ObjectId[] = [];
  const seen = new Set<string>();
  for (const id of parts) {
    if (!mongoose.Types.ObjectId.isValid(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(new mongoose.Types.ObjectId(id));
  }
  return out;
}

const DISCOUNT_TYPES = new Set(["percentage", "flat"]);
const TIER_UNITS = new Set(["packets", "outer"]);

export function isDiscountType(v: unknown): v is "percentage" | "flat" {
  return typeof v === "string" && DISCOUNT_TYPES.has(v);
}

export function parseTierUnit(v: unknown): "packets" | "outer" {
  return typeof v === "string" && TIER_UNITS.has(v) ? (v as "packets" | "outer") : "packets";
}

export type PacketTierInput = { minPackets: number; value: number };

/** Sort by minPackets; for duplicate thresholds keep the larger discount `value`. */
function dedupePacketTiers(tiers: PacketTierInput[]): PacketTierInput[] {
  const byMin = new Map<number, number>();
  for (const t of tiers) {
    const cur = byMin.get(t.minPackets);
    if (cur === undefined || t.value > cur) byMin.set(t.minPackets, t.value);
  }
  return [...byMin.entries()]
    .map(([minPackets, value]) => ({ minPackets, value }))
    .sort((a, b) => a.minPackets - b.minPackets);
}

/**
 * Parse tier rows from admin JSON. Does not enforce value ranges (depends on discountType).
 */
export function parsePacketTiers(raw: unknown): PacketTierInput[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: PacketTierInput[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const o = row as Record<string, unknown>;
    const minPackets = Number(o.minPackets);
    const value = Number(o.value);
    if (!Number.isFinite(minPackets) || minPackets < 0) continue;
    if (!Number.isFinite(value) || value < 0) continue;
    out.push({ minPackets, value });
  }
  return dedupePacketTiers(out);
}

export function validatePacketTiersForDiscountType(
  tiers: PacketTierInput[],
  discountType: "percentage" | "flat"
): string | null {
  if (tiers.length === 0) return "packetTiers must include at least one row";
  for (const t of tiers) {
    if (discountType === "percentage") {
      if (t.value > 100) return "percentage tier values must be between 0 and 100";
    } else if (t.value <= 0) {
      return "flat tier values must be positive INR amounts";
    }
  }
  return null;
}
