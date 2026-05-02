import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest) {
  try {
    await connectDb();
    const sp = req.nextUrl.searchParams;
    const filter: Record<string, unknown> = {};
    if (sp.get("isActive") === "true") filter.isActive = true;
    if (sp.get("isActive") === "false") filter.isActive = false;
    const rows = await ComboRuleModel.find(filter).sort({ updatedAt: -1 }).lean();
    const data = rows.map((r) => serializeComboRuleLean(r as Parameters<typeof serializeComboRuleLean>[0])!);
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const existingCount = await ComboRuleModel.countDocuments({});
    if (existingCount > 0) {
      return err("Only one combo rule is allowed. Please edit the existing rule.", 409);
    }
    const body = (await req.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return err("name is required", 400);

    const triggerSlugs = parseSlugList(body.triggerSlugs);
    const targetSlugs = parseSlugList(body.targetSlugs);
    const fallbackTargetSlugs = parseSlugList(body.fallbackTargetSlugs);
    const triggerCategoryIds = parseObjectIdList(body.triggerCategoryIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const targetCategoryIds = parseObjectIdList(body.targetCategoryIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const fallbackCategoryIds = parseObjectIdList(body.fallbackCategoryIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const minTriggerBags = parseMinTriggerBags(body.minTriggerBags, 3);
    const minTargetBags = parseMinTriggerBags(body.minTargetBags, 1);
    const triggerThresholdUnit = parseThresholdUnit(body.triggerThresholdUnit, "bags");
    const targetThresholdUnit = parseThresholdUnit(body.targetThresholdUnit, "bags");
    let comboPriceInclGst: number | undefined;
    const rawPrice = body.comboPriceInclGst;
    if (hasComboPriceInclGstInput(rawPrice)) {
      const p = parseComboPriceInclGst(rawPrice);
      if (p === null) return err("comboPriceInclGst must be a non-negative number", 400);
      comboPriceInclGst = p;
    }

    const doc = await ComboRuleModel.create({
      name,
      triggerSlugs,
      targetSlugs,
      fallbackTargetSlugs,
      triggerCategoryIds,
      targetCategoryIds,
      fallbackCategoryIds,
      minTriggerBags,
      minTargetBags,
      triggerThresholdUnit,
      targetThresholdUnit,
      ...(comboPriceInclGst !== undefined ? { comboPriceInclGst } : {}),
      suggestionMessage: typeof body.suggestionMessage === "string" ? body.suggestionMessage.trim() : "",
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    });
    const targetSlugsNorm = targetSlugs
      .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
      .filter((s): s is string => s.length > 0);
    const fallbackTargetSlugsNorm = fallbackTargetSlugs
      .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
      .filter((s): s is string => s.length > 0);
    if (fallbackTargetSlugsNorm.length > 0) {
      await ProductModel.updateMany(
        { slug: { $in: fallbackTargetSlugsNorm } },
        { $set: { isEligibleForCombo: false } }
      );
    }
    if (targetSlugsNorm.length > 0) {
      await ProductModel.updateMany(
        { slug: { $in: targetSlugsNorm } },
        { $set: { isEligibleForCombo: true } }
      );
    }
    const row = await ComboRuleModel.findById(doc._id).lean();
    return NextResponse.json({
      data: serializeComboRuleLean(row as Parameters<typeof serializeComboRuleLean>[0]),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
