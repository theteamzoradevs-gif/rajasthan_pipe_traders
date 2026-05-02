import mongoose, { Schema, models, model } from "mongoose";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    sortOrder: { type: Number, default: 0 },
    sourceSectionLabel: { type: String, trim: true },
    /** Primary image URL (e.g. Cloudinary secure_url) */
    image: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ parent: 1, sortOrder: 1 });

/**
 * `slug` is unique via the field definition (single `slug_1` index). If Atlas still shows an extra
 * duplicate index on `slug` from an older schema, drop the stale index in the shell/UI — duplicate
 * unique indexes cause confusing E11000 errors after deletes or re-imports.
 */
export const CategoryModel = models.Category ?? model("Category", categorySchema);
