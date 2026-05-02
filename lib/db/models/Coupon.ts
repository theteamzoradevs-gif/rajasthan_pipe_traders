import mongoose, { Schema, models, model } from "mongoose";

const DISCOUNT_TYPES = ["percentage", "flat"] as const;

/** How `packetTiers[].minPackets` is interpreted for tier unlock (discount still applies to eligible ₹). */
const TIER_UNITS = ["packets", "outer"] as const;

/**
 * Discount steps: each row has `minPackets` (minimum tier count) and `value` (% or flat ₹).
 * When `tierUnit` is `packets`, thresholds use total eligible **packets** (carton/bag list units
 * convert to packets via packaging). When `tierUnit` is `outer`, thresholds use **outer shipping
 * units**: master bags count as bags; packet lines convert to cartons when carton size is known,
 * else to master-bag equivalents; per-carton / per-bag Mongo pricing counts priced outers.
 */
const packetTierSchema = new Schema(
  {
    minPackets: { type: Number, required: true, min: 0 },
    /** Percent (0–100) when discountType is `percentage`; INR off when `flat`. */
    value: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    discountType: {
      type: String,
      enum: DISCOUNT_TYPES,
      required: true,
    },
    packetTiers: {
      type: [packetTierSchema],
      required: true,
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length > 0,
        message: "At least one packet tier is required",
      },
    },
    tierUnit: {
      type: String,
      enum: TIER_UNITS,
      default: "packets",
    },
    /** Empty = coupon applies to all products */
    applicableProductIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    /** Empty = all categories (when product lists also empty, entire catalog) */
    applicableCategoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/** `code` is already unique on the field; no compound index needed for lookups. */

export const CouponModel = models.Coupon ?? model("Coupon", couponSchema);
