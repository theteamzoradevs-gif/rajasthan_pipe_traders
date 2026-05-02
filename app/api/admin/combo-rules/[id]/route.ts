import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { ComboRuleModel } from "@/lib/db/models/ComboRule";
import { ProductModel } from "@/lib/db/models/Product";
import { serializeComboRuleLean } from "@/lib/db/serialize";
import {
  hasComboPriceInclGstInput,
  parseComboPriceInclGst,
  parseMinTriggerBags,
  parseObjectIdList,
  parseSlugList,
} from "@/lib/comboRules/comboRulePayload";
import { parseThresholdUnit } from "@/lib/comboRules/thresholdUnits";

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function normSlugList(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    .filter((s): s is string => s.length > 0);
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return err("Invalid combo rule id", 400);
    await connectDb();
    const row = await ComboRuleModel.findById(id).lean();
    if (!row) return err("Combo rule not found", 404);
    return NextResponse.json({
      data: serializeComboRuleLean(row as Parameters<typeof serializeComboRuleLean>[0]),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return err("Invalid combo rule id", 400);
    await connectDb();
    const prev = await ComboRuleModel.findById(id).lean();
    if (!prev) return err("Combo rule not found", 404);
    const body = (await req.json()) as Record<string, unknown>;
    const $set: Record<string, unknown> = {};
    let $unset: Record<string, 1> | undefined;

    if (typeof body.name === "string") {
      const n = body.name.trim();
      if (!n) return err("name cannot be empty", 400);
      $set.name = n;
    }
    if (Object.prototype.hasOwnProperty.call(body, "triggerSlugs")) {
      $set.triggerSlugs = parseSlugList(body.triggerSlugs);
    }
    if (Object.prototype.hasOwnProperty.call(body, "targetSlugs")) {
      $set.targetSlugs = parseSlugList(body.targetSlugs);
    }
    if (Object.prototype.hasOwnProperty.call(body, "fallbackTargetSlugs")) {
      $set.fallbackTargetSlugs = parseSlugList(body.fallbackTargetSlugs);
    }
    if (body.triggerCategoryIds !== undefined) {
      $set.triggerCategoryIds = parseObjectIdList(body.triggerCategoryIds).map(
        (id) => new mongoose.Types.ObjectId(id)
      );
    }
    if (body.targetCategoryIds !== undefined) {
      $set.targetCategoryIds = parseObjectIdList(body.targetCategoryIds).map(
        (id) => new mongoose.Types.ObjectId(id)
      );
    }
    if (body.fallbackCategoryIds !== undefined) {
      $set.fallbackCategoryIds = parseObjectIdList(body.fallbackCategoryIds).map(
        (id) => new mongoose.Types.ObjectId(id)
      );
    }
    if (Object.prototype.hasOwnProperty.call(body, "minTriggerBags")) {
      $set.minTriggerBags = parseMinTriggerBags(body.minTriggerBags, 3);
    }
    if (Object.prototype.hasOwnProperty.call(body, "minTargetBags")) {
      $set.minTargetBags = parseMinTriggerBags(body.minTargetBags, 1);
    }
    if (Object.prototype.hasOwnProperty.call(body, "triggerThresholdUnit")) {
      $set.triggerThresholdUnit = parseThresholdUnit(body.triggerThresholdUnit, "bags");
    }
    if (Object.prototype.hasOwnProperty.call(body, "targetThresholdUnit")) {
      $set.targetThresholdUnit = parseThresholdUnit(body.targetThresholdUnit, "bags");
    }
    if (Object.prototype.hasOwnProperty.call(body, "comboPriceInclGst")) {
      const raw = body.comboPriceInclGst;
      if (!hasComboPriceInclGstInput(raw)) {
        $unset = { comboPriceInclGst: 1 };
      } else {
        const p = parseComboPriceInclGst(raw);
        if (p === null) {
          return err("comboPriceInclGst must be a non-negative number", 400);
        }
        $set.comboPriceInclGst = p;
      }
    }
    if (typeof body.suggestionMessage === "string") $set.suggestionMessage = body.suggestionMessage.trim();
    if (typeof body.isActive === "boolean") $set.isActive = body.isActive;

    if (Object.keys($set).length === 0 && !$unset) {
      const row = await ComboRuleModel.findById(id).lean();
      if (!row) return err("Combo rule not found", 404);
      return NextResponse.json({
        data: serializeComboRuleLean(row as Parameters<typeof serializeComboRuleLean>[0]),
      });
    }

    const updatePayload: mongoose.UpdateQuery<unknown> = {};
    if (Object.keys($set).length > 0) updatePayload.$set = $set;
    if ($unset) updatePayload.$unset = $unset;

    const row = await ComboRuleModel.findByIdAndUpdate(id, updatePayload, { new: true, runValidators: true }).lean();
    if (!row) return err("Combo rule not found", 404);
    const prevTargetSlugs = normSlugList((prev as { targetSlugs?: unknown }).targetSlugs);
    const prevFallbackTargetSlugs = normSlugList((prev as { fallbackTargetSlugs?: unknown }).fallbackTargetSlugs);
    const targetSlugs = normSlugList((row as { targetSlugs?: unknown }).targetSlugs);
    const fallbackTargetSlugs = normSlugList((row as { fallbackTargetSlugs?: unknown }).fallbackTargetSlugs);
    const prevAll = new Set<string>([...prevTargetSlugs, ...prevFallbackTargetSlugs]);
    const nextAll = new Set<string>([...targetSlugs, ...fallbackTargetSlugs]);
    const removedSlugs = [...prevAll].filter((s) => !nextAll.has(s));
    if (removedSlugs.length > 0) {
      await ProductModel.updateMany(
        { slug: { $in: removedSlugs } },
        { $set: { isEligibleForCombo: null } }
      );
    }
    if (fallbackTargetSlugs.length > 0) {
      await ProductModel.updateMany(
        { slug: { $in: fallbackTargetSlugs } },
        { $set: { isEligibleForCombo: false } }
      );
    }
    if (targetSlugs.length > 0) {
      await ProductModel.updateMany(
        { slug: { $in: targetSlugs } },
        { $set: { isEligibleForCombo: true } }
      );
    }
    return NextResponse.json({
      data: serializeComboRuleLean(row as Parameters<typeof serializeComboRuleLean>[0]),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return err("Invalid combo rule id", 400);
    await connectDb();
    const deleted = await ComboRuleModel.findByIdAndDelete(id).lean();
    if (!deleted) return err("Combo rule not found", 404);

    const targetSlugs = normSlugList((deleted as { targetSlugs?: unknown }).targetSlugs);
    const fallbackTargetSlugs = normSlugList(
      (deleted as { fallbackTargetSlugs?: unknown }).fallbackTargetSlugs
    );
    const slugSet = new Set<string>([...targetSlugs, ...fallbackTargetSlugs]);
    const allSlugs = [...slugSet];
    if (allSlugs.length > 0) {
      await ProductModel.updateMany({ slug: { $in: allSlugs } }, { $set: { isEligibleForCombo: null } });
    }

    return NextResponse.json({ data: { _id: id, deleted: true } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
