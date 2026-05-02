export const THRESHOLD_UNITS = ["packets", "bags", "cartons"] as const;
export type ThresholdUnit = (typeof THRESHOLD_UNITS)[number];

export function isThresholdUnit(u: unknown): u is ThresholdUnit {
  return typeof u === "string" && (THRESHOLD_UNITS as readonly string[]).includes(u);
}

export function parseThresholdUnit(input: unknown, fallback: ThresholdUnit): ThresholdUnit {
  return isThresholdUnit(input) ? input : fallback;
}

/** Human-readable shortfall like "5 packets" / "1 carton". */
export function formatCountWithUnit(count: number, unit: ThresholdUnit): string {
  const n = Math.max(0, Math.floor(count));
  switch (unit) {
    case "packets":
      return `${n} ${n === 1 ? "packet" : "packets"}`;
    case "bags":
      return `${n} ${n === 1 ? "bag" : "bags"}`;
    case "cartons":
      return `${n} ${n === 1 ? "carton" : "cartons"}`;
    default:
      return String(n);
  }
}
