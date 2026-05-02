import mongoose, { Schema, models, model } from "mongoose";

const appSettingsSchema = new Schema(
  {
    /** Singleton key — only one document expected */
    key: { type: String, required: true, unique: true, default: "global" },
    /** Minimum order value including GST (₹) */
    minimumOrderInclGst: { type: Number, required: true, default: 25_000 },
    /** Prices effective date (DD-MM-YYYY format) */
    pricesEffectiveDate: { type: String, default: "" },
  },
  { timestamps: true }
);

export const AppSettingsModel = models.AppSettings ?? model("AppSettings", appSettingsSchema);
