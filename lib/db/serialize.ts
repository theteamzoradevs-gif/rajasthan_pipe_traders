import mongoose from "mongoose";

type LeanDoc = Record<string, unknown> & { _id: mongoose.Types.ObjectId };

function idString(id: unknown): string {
  if (id instanceof mongoose.Types.ObjectId) return id.toHexString();
  return String(id);
}

/** Shape aligned with FRONTEND_API_INTEGRATION.md Category */
export function serializeCategoryLean(doc: LeanDoc | null): Record<string, unknown> | null {
  if (!doc) return null;
  const out: Record<string, unknown> = { ...doc, _id: idString(doc._id) };
  const rawParent = doc.parent as LeanDoc | mongoose.Types.ObjectId | null | undefined;
  if (rawParent instanceof mongoose.Types.ObjectId) {
    out.parent = { _id: idString(rawParent), name: "", slug: "" };
  } else if (rawParent && typeof rawParent === "object" && rawParent._id) {
    out.parent = {
      _id: idString(rawParent._id),
      name: typeof rawParent.name === "string" ? rawParent.name : "",
      slug: typeof rawParent.slug === "string" ? rawParent.slug : "",
    };
  } else {
    out.parent = null;
  }
  return out;
}

/** Shape aligned with FRONTEND_API_INTEGRATION.md Product */
export function serializeProductLean(doc: LeanDoc | null): Record<string, unknown> | null {
  if (!doc) return null;
  const out: Record<string, unknown> = { ...doc, _id: idString(doc._id) };
  const rawCat = doc.category as LeanDoc | mongoose.Types.ObjectId | null | undefined;
  if (rawCat instanceof mongoose.Types.ObjectId) {
    out.category = { _id: idString(rawCat), name: "", slug: "" };
  } else if (rawCat && typeof rawCat === "object" && rawCat._id) {
    out.category = {
      _id: idString(rawCat._id),
      name: typeof rawCat.name === "string" ? rawCat.name : "",
      slug: typeof rawCat.slug === "string" ? rawCat.slug : "",
    };
  } else {
    out.category = null;
  }
  return out;
}

function mapIdArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    if (x && typeof x === "object" && "_id" in x) {
      return idString((x as LeanDoc)._id);
    }
    return idString(x);
  });
}

/** Coupon for admin/public JSON */
export function serializeCouponLean(doc: LeanDoc | null): Record<string, unknown> | null {
  if (!doc) return null;
  const out: Record<string, unknown> = { ...doc, _id: idString(doc._id) };
  const prods = doc.applicableProductIds as unknown;
  const cats = doc.applicableCategoryIds as unknown;
  if (Array.isArray(prods) && prods[0] && typeof prods[0] === "object" && "_id" in (prods[0] as object)) {
    const list = prods as LeanDoc[];
    out.applicableProductIds = list.map((p) => idString(p._id));
    out.applicableProducts = list.map((p) => ({
      _id: idString(p._id),
      sku: p.sku,
      name: p.name,
      slug: p.slug,
    }));
  } else {
    out.applicableProductIds = mapIdArray(prods);
  }
  if (Array.isArray(cats) && cats[0] && typeof cats[0] === "object" && "_id" in (cats[0] as object)) {
    const list = cats as LeanDoc[];
    out.applicableCategoryIds = list.map((c) => idString(c._id));
    out.applicableCategories = list.map((c) => ({
      _id: idString(c._id),
      name: c.name,
      slug: c.slug,
    }));
  } else {
    out.applicableCategoryIds = mapIdArray(cats);
  }
  return out;
}

/** Combo rule for admin JSON */
export function serializeComboRuleLean(doc: LeanDoc | null): Record<string, unknown> | null {
  if (!doc) return null;
  const triggerSlugs = doc.triggerSlugs;
  const targetSlugs = doc.targetSlugs;
  const fallbackTargetSlugs = doc.fallbackTargetSlugs;
  return {
    _id: idString(doc._id),
    name: doc.name,
    triggerSlugs: Array.isArray(triggerSlugs) ? [...triggerSlugs] : [],
    targetSlugs: Array.isArray(targetSlugs) ? [...targetSlugs] : [],
    fallbackTargetSlugs: Array.isArray(fallbackTargetSlugs) ? [...fallbackTargetSlugs] : [],
    triggerCategoryIds: mapIdArray(doc.triggerCategoryIds),
    targetCategoryIds: mapIdArray(doc.targetCategoryIds),
    fallbackCategoryIds: mapIdArray(doc.fallbackCategoryIds),
    minTriggerBags: doc.minTriggerBags,
    minTargetBags:
      typeof doc.minTargetBags === "number" && Number.isFinite(doc.minTargetBags) ? doc.minTargetBags : 1,
    triggerThresholdUnit:
      doc.triggerThresholdUnit === "packets" || doc.triggerThresholdUnit === "bags" || doc.triggerThresholdUnit === "cartons"
        ? doc.triggerThresholdUnit
        : "bags",
    targetThresholdUnit:
      doc.targetThresholdUnit === "packets" || doc.targetThresholdUnit === "bags" || doc.targetThresholdUnit === "cartons"
        ? doc.targetThresholdUnit
        : "bags",
    comboPriceInclGst:
      typeof doc.comboPriceInclGst === "number" && Number.isFinite(doc.comboPriceInclGst) ? doc.comboPriceInclGst : undefined,
    suggestionMessage: typeof doc.suggestionMessage === "string" ? doc.suggestionMessage : "",
    isActive: Boolean(doc.isActive),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
