import mongoose, { Schema, model, models } from "mongoose";

const LEAD_STATUS = ["ordered", "non-ordered"] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

const leadSchema = new Schema(
  {
    phone: { type: String, required: true, trim: true, index: true, unique: true },
    status: { type: String, enum: LEAD_STATUS, default: "non-ordered" },
    itemsInCart: { type: [Schema.Types.Mixed], default: () => [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { suppressReservedKeysWarning: true }
);

if (models.Lead) {
  mongoose.deleteModel("Lead");
}

export const LeadModel = model("Lead", leadSchema);
