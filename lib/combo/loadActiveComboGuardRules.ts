import { connectDb } from "@/lib/db/connect";
import { ComboRuleModel } from "@/lib/db/models/ComboRule";
import type { ComboRuleGuard } from "@/lib/combo/comboAddGuard";
import { expandManyComboRulesForRuntime } from "@/lib/combo/expandComboRuleSlugs";

function normSlugList(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean))];
}

function categoryIdsToStrings(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x)).filter(Boolean);
}

type ExpandedRow = {
  _id: unknown;
  name?: unknown;
  triggerSlugs: string[];
  targetSlugs: string[];
  fallbackTargetSlugs?: unknown;
  triggerCategoryIds?: unknown;
  targetCategoryIds?: unknown;
  minTriggerBags?: unknown;
  minTargetBags?: unknown;
  triggerThresholdUnit?: unknown;
  targetThresholdUnit?: unknown;
  suggestionMessage?: unknown;
  isActive?: unknown;
};

function asThresholdUnit(v: unknown): "packets" | "bags" | "cartons" {
  return v === "packets" || v === "bags" || v === "cartons" ? v : "bags";
}

/** Active combo guard rules (expanded slugs) — server + `/api/combo/active-guard-rules`. */
export async function loadActiveComboGuardRules(): Promise<ComboRuleGuard[]> {
  await connectDb();
  const rows = await ComboRuleModel.find({ isActive: true })
    .select(
      "_id name triggerSlugs targetSlugs fallbackTargetSlugs triggerCategoryIds targetCategoryIds minTriggerBags minTargetBags triggerThresholdUnit targetThresholdUnit suggestionMessage isActive"
    )
    .sort({ _id: 1 })
    .lean();

  const expanded = (await expandManyComboRulesForRuntime(
    rows as Parameters<typeof expandManyComboRulesForRuntime>[0]
  )) as ExpandedRow[];

  return expanded.map((r) => ({
    _id: String(r._id),
    name: typeof r.name === "string" ? r.name : "",
    triggerSlugs: r.triggerSlugs,
    targetSlugs: r.targetSlugs,
    fallbackTargetSlugs: normSlugList(r.fallbackTargetSlugs),
    triggerCategoryIds: categoryIdsToStrings(r.triggerCategoryIds),
    targetCategoryIds: categoryIdsToStrings(r.targetCategoryIds),
    minTriggerBags:
      typeof r.minTriggerBags === "number" && Number.isFinite(r.minTriggerBags) ? r.minTriggerBags : 3,
    minTargetBags:
      typeof r.minTargetBags === "number" && Number.isFinite(r.minTargetBags) ? r.minTargetBags : 1,
    triggerThresholdUnit: asThresholdUnit(r.triggerThresholdUnit),
    targetThresholdUnit: asThresholdUnit(r.targetThresholdUnit),
    suggestionMessage: typeof r.suggestionMessage === "string" ? r.suggestionMessage : "",
    isActive: r.isActive === true,
  }));
}
