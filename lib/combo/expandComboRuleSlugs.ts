import mongoose from "mongoose";
import { ProductModel } from "@/lib/db/models/Product";

export type ComboRuleSlugSource = {
  triggerSlugs?: unknown;
  targetSlugs?: unknown;
  /** Explicit fallback targets (not expanded from categories in this helper). */
  fallbackTargetSlugs?: unknown;
  triggerCategoryIds?: unknown;
  targetCategoryIds?: unknown;
};

function normSlugs(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean))];
}

function toObjectIds(input: unknown): mongoose.Types.ObjectId[] {
  if (!Array.isArray(input)) return [];
  const out: mongoose.Types.ObjectId[] = [];
  for (const x of input) {
    const s = String(x);
    if (mongoose.Types.ObjectId.isValid(s)) out.push(new mongoose.Types.ObjectId(s));
  }
  return out;
}

/**
 * For each category id, load active product slugs (one query for all ids).
 */
async function slugSetsByCategoryIds(
  ids: mongoose.Types.ObjectId[]
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (ids.length === 0) return map;
  const uniq = [...new Map(ids.map((id) => [id.toString(), id])).values()];
  const rows = await ProductModel.find({ category: { $in: uniq }, isActive: true })
    .select("slug category")
    .lean();
  for (const r of rows) {
    const cid = r.category != null ? String(r.category) : "";
    const slug = typeof r.slug === "string" ? r.slug.trim().toLowerCase() : "";
    if (!cid || !slug) continue;
    if (!map.has(cid)) map.set(cid, new Set());
    map.get(cid)!.add(slug);
  }
  return map;
}

/** Batch-expand multiple rules with minimal DB reads. */
export async function expandManyComboRulesForRuntime<
  T extends ComboRuleSlugSource & { _id?: unknown },
>(rules: T[]): Promise<Array<T & { triggerSlugs: string[]; targetSlugs: string[] }>> {
  const allTrigCats: mongoose.Types.ObjectId[] = [];
  const allTgtCats: mongoose.Types.ObjectId[] = [];
  for (const r of rules) {
    allTrigCats.push(...toObjectIds(r.triggerCategoryIds));
    allTgtCats.push(...toObjectIds(r.targetCategoryIds));
  }
  const allCats = [...new Map([...allTrigCats, ...allTgtCats].map((id) => [id.toString(), id])).values()];
  const byCat = await slugSetsByCategoryIds(allCats);

  return rules.map((r) => {
    const explicitTrigger = normSlugs(r.triggerSlugs);
    const explicitTarget = normSlugs(r.targetSlugs);
    const trigger = new Set(explicitTrigger);
    const target = new Set(explicitTarget);
    // When explicit slugs exist, do not merge category products — same category on trigger + target
    // would otherwise put every SKU in both pools (wrong guard / pricing).
    if (explicitTrigger.length === 0) {
      for (const id of toObjectIds(r.triggerCategoryIds)) {
        const set = byCat.get(id.toString());
        if (set) set.forEach((s) => trigger.add(s));
      }
    }
    if (explicitTarget.length === 0) {
      for (const id of toObjectIds(r.targetCategoryIds)) {
        const set = byCat.get(id.toString());
        if (set) set.forEach((s) => target.add(s));
      }
    }
    return {
      ...r,
      triggerSlugs: [...trigger],
      targetSlugs: [...target],
    };
  });
}

/** Expands one rule (same logic as batch). */
export async function expandComboRuleSlugs<T extends ComboRuleSlugSource>(
  rule: T
): Promise<{ triggerSlugs: string[]; targetSlugs: string[] }> {
  const [one] = await expandManyComboRulesForRuntime([rule as T & { _id?: unknown }]);
  return { triggerSlugs: one.triggerSlugs, targetSlugs: one.targetSlugs };
}
