import type { KeyFeatureIcon, KeyFeatureLine } from "@/app/data/products";

const ICONS = new Set<KeyFeatureIcon>(["check", "material", "dot"]);

export function normalizeKeyFeatureIcon(raw: unknown): KeyFeatureIcon {
  if (raw === "material" || raw === "dot" || raw === "check") return raw;
  return "check";
}

/** Sanitize API / admin payload into DB-ready rows, or null to omit / unset. */
export function sanitizeKeyFeaturesInput(raw: unknown): KeyFeatureLine[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const out: KeyFeatureLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text) continue;
    const icon = ICONS.has(row.icon as KeyFeatureIcon) ? (row.icon as KeyFeatureIcon) : "check";
    out.push({ text, icon });
  }
  return out.length ? out : null;
}
