import mongoose, { Schema, models, model } from "mongoose";

const THRESHOLD_UNITS = ["packets", "bags", "cartons"] as const;

const comboRuleSchema = new Schema(
  {
    /** Descriptive name for the rule */
    name: { type: String, required: true, trim: true },
    /** Product slugs that provide the pool (explicit picks; categories also contribute at runtime). */
    triggerSlugs: { type: [String], default: [] },
    /** Product slugs that receive combo pricing (explicit picks). */
    targetSlugs: { type: [String], default: [] },
    /** Product slugs to show when trigger threshold is not met (regular/higher-price alternatives). */
    fallbackTargetSlugs: { type: [String], default: [] },
    /** Categories whose products all count as triggers (expanded to slugs at runtime). */
    triggerCategoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    /** Categories whose products all count as targets (expanded to slugs at runtime). */
    targetCategoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    /** Categories whose products may be shown as fallback targets before trigger unlock. */
    fallbackCategoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    /** Bags required from trigger slugs before combo can activate */
    minTriggerBags: { type: Number, default: 3, min: 0 },
    /** Bags required from target slugs before combo can activate (both thresholds must be met) */
    minTargetBags: { type: Number, default: 1, min: 0 },
    /** How `minTriggerBags` is interpreted: raw packets, master bags, or cartons */
    triggerThresholdUnit: {
      type: String,
      enum: THRESHOLD_UNITS,
      default: "bags",
    },
    /** How `minTargetBags` is interpreted for the target side */
    targetThresholdUnit: {
      type: String,
      enum: THRESHOLD_UNITS,
      default: "bags",
    },
    /** @deprecated Prefer combo rates on product size rows; kept for legacy rules only. Omit when unused. */
    comboPriceInclGst: { type: Number, required: false, min: 0 },
    /** B2C upsell copy (e.g. Add 3 more of 20mm to get offer!) */
    suggestionMessage: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

comboRuleSchema.index({ isActive: 1 });

export const ComboRuleModel = models.ComboRule ?? model("ComboRule", comboRuleSchema);
