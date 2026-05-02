import mongoose, { Schema, models, model } from "mongoose";

const discountTierSchema = new Schema(
  {
    qty: { type: String, required: true },
    discount: { type: String, required: true },
  },
  { _id: false }
);



const packingLabelsPartialSchema = new Schema(
  {
    inner: { type: String, trim: true },
    innerPlural: { type: String, trim: true },
    outer: { type: String, trim: true },
    outerPlural: { type: String, trim: true },
    outerHeading: { type: String, trim: true },
    innerHeading: { type: String, trim: true },
  },
  { _id: false }
);

const catalogSizeSchema = new Schema(
  {
    size: { type: String, required: true },
    basicPrice: { type: Number, required: true },
    priceWithGst: { type: Number, required: true },
    /** Net combo rate (ex-GST) — no slab discounts when applied */
    comboBasicPrice: { type: Number },
    /** Net combo rate (incl. GST) — no slab discounts when applied */
    comboPriceWithGst: { type: Number },
    /**
     * Marks this size row as 20MM or 25MM core clip for combo matching.
     * Non-combo list rates remain `basicPrice` / `priceWithGst`.
     */
    coreComboVariant: { type: String, enum: ["20", "25"], default: undefined },
    /** When true, this size row counts toward the eligible packet pool (overrides product-level when set). */
    countsTowardComboEligible: { type: Boolean },
    qtyPerBag: Number,
    pcsPerPacket: Number,
    note: { type: String, trim: true },
    packingLabels: { type: packingLabelsPartialSchema, default: undefined },
  },
  { _id: false }
);

const catalogSellerOfferSchema = new Schema(
  {
    sellerId: { type: String, required: true },
    sellerName: { type: String, required: true },
    brand: { type: String, required: true },
    sizes: { type: [catalogSizeSchema], default: [] },
    discountTiers: { type: [discountTierSchema], default: [] },
    minOrder: { type: String, trim: true },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const keyFeatureLineSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    icon: {
      type: String,
      enum: ["check", "material", "dot"],
      default: "check",
    },
  },
  { _id: false }
);

const packagingSchema = new Schema(
  {
    innerBoxPacking: Number,
    pcsInCartoon: Number,
    pcsPerPacket: Number,
    packetsInMasterBag: Number,
    pktInMasterBag: Number,
    pcsInPacket: Number,
    pcsPerBox: Number,
    boxesInMasterCartoon: Number,
    masterCartoonQty: Number,
    pricingUnit: {
      type: String,
      enum: [
        "per_piece",
        "per_packet",
        "per_box",
        "per_cartoon",
        "per_dozen",
        "per_bag",
        "per_master_bag",
        "other",
      ],
      default: "per_piece",
    },
    notes: { type: String, trim: true },
    /** Admin: outer sell options (bags / carton), order preserved */
    bulkUnitChoices: { type: [String], default: undefined },
    /** Admin: inner sell options (packet / box), order preserved */
    innerUnitChoices: { type: [String], default: undefined },
  },
  { _id: false }
);

const pricingSchema = new Schema(
  {
    basicPrice: { type: Number, required: true },
    priceWithGst: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    priceListEffectiveDate: { type: Date },
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    sku: {
      type: String,
      required: false,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    productKind: {
      type: String,
      enum: ["sku", "catalog"],
      default: "sku",
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    legacyId: { type: Number, sparse: true },
    alternateSkus: [{ type: String, trim: true }],
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    longDescription: { type: String, trim: true },
    subCategory: { type: String, trim: true },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    /** Display order within the same category (admin; lower first). */
    sortOrder: { type: Number, default: 0 },
    /** Display order specifically within its assigned category (separate from global sortOrder). */
    categorySortOrder: { type: Number, default: 0 },
    brand: { type: String, trim: true },
    brandCode: { type: String, trim: true },
    productLine: { type: String, trim: true },
    sizeOrModel: { type: String, trim: true },
    features: [{ type: String, trim: true }],
    /** PDP key features — optional; **bold** / newlines in text; icon per row */
    keyFeatures: { type: [keyFeatureLineSchema], default: undefined },
    image: { type: String, trim: true },
    images: [{ type: String, trim: true }],
    isNew: { type: Boolean, default: false },
    /** PDP trust bar: show “ISI Certified” when true (optional; default false) */
    isIsiCertified: { type: Boolean, default: false },
    isBestseller: { type: Boolean },
    tags: [{ type: String, trim: true }],
    certifications: [{ type: String, trim: true }],
    material: { type: String, trim: true },
    minOrder: { type: String, trim: true },
    moq: { type: Number },
    /** Minimum order in master bags (optional; enforced with `moq` in packet terms on storefront) */
    moqBags: { type: Number },
    note: { type: String, trim: true },
    discountTiers: { type: [discountTierSchema], default: undefined },
    sizes: { type: [catalogSizeSchema], default: undefined },
    sellers: { type: [catalogSellerOfferSchema], default: undefined },
    pricing: { type: pricingSchema, required: true },
    packaging: { type: packagingSchema, default: () => ({}) },
    listNotes: { type: String, trim: true },
    /** RPT price list wording for PDP order UI (outer bulk / inner priced unit) */
    packingUnitLabels: { type: packingLabelsPartialSchema, default: undefined },
    isActive: { type: Boolean, default: true },
    sourceDocument: { type: String, default: "RPT PRICE LIST" },
    /**
     * null = not a combo target/fallback (admin trigger picker treats non-boolean as eligible).
     * true = combo target; false = combo fallback (set by combo rule APIs).
     */
    isEligibleForCombo: {
      type: Schema.Types.Mixed,
      validate: {
        validator(v: unknown) {
          return v === null || typeof v === "boolean";
        },
        message: "isEligibleForCombo must be null or a boolean",
      },
      default: null,
    },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

productSchema.index({ category: 1, sortOrder: 1 });
productSchema.index({ isEligibleForCombo: 1 });
productSchema.index({ brand: 1 });
/** Full-text search for storefront/admin queries */
productSchema.index({ name: "text", sku: "text", description: "text" });

/**
 * `sku` and `slug` use field-level `unique` + `sparse` so omitted/null values do not collide.
 * Do not add duplicate `schema.index({ sku: 1 })` / `{ slug: 1 }` — that would create a second index.
 */

// Next.js hot reload keeps `mongoose.models.Product` with the first-loaded schema;
// delete so optional `sku` and index changes apply after edits (avoids "sku is required" from stale cache).
if (models.Product) {
  mongoose.deleteModel("Product");
}
export const ProductModel = model("Product", productSchema);
