import mongoose from "mongoose";

const discountTierSchema = new mongoose.Schema(
  {
    qty: { type: String, required: true },
    discount: { type: String, required: true },
  },
  { _id: false }
);

/** Matches docs/products.ts ProductSize (qtyPerBag / pcsPerPacket = PDF packing columns). */
const catalogSizeSchema = new mongoose.Schema(
  {
    size: { type: String, required: true },
    basicPrice: { type: Number, required: true },
    priceWithGst: { type: Number, required: true },
    qtyPerBag: Number,
    pcsPerPacket: Number,
    note: { type: String, trim: true },
  },
  { _id: false }
);

/** Matches docs/products.ts ProductSellerOffer */
const catalogSellerOfferSchema = new mongoose.Schema(
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

const packagingSchema = new mongoose.Schema(
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
  },
  { _id: false }
);

const pricingSchema = new mongoose.Schema(
  {
    basicPrice: { type: Number, required: true },
    priceWithGst: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    priceListEffectiveDate: { type: Date },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    /** Line-item SKU (price list) or synthetic CAT-{SLUG} for catalog parents from docs/products.ts */
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    /** sku = row-level price list; catalog = grouped product with embedded sizes / sellers */
    productKind: {
      type: String,
      enum: ["sku", "catalog"],
      default: "sku",
    },
    /** URL slug; set for catalog products (sparse unique) */
    slug: { type: String, trim: true, lowercase: true },
    legacyId: { type: Number, sparse: true },
    alternateSkus: [{ type: String, trim: true }],
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    longDescription: { type: String, trim: true },
    subCategory: { type: String, trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    brand: { type: String, trim: true },
    brandCode: { type: String, trim: true },
    productLine: { type: String, trim: true },
    sizeOrModel: { type: String, trim: true },
    features: [{ type: String, trim: true }],
    image: { type: String, trim: true },
    images: [{ type: String, trim: true }],
    isNew: { type: Boolean, default: false },
    isBestseller: { type: Boolean },
    tags: [{ type: String, trim: true }],
    certifications: [{ type: String, trim: true }],
    material: { type: String, trim: true },
    minOrder: { type: String, trim: true },
    moq: { type: Number },
    /** Product-level note (e.g. tape / ball valve discount note from PDF) */
    note: { type: String, trim: true },
    discountTiers: { type: [discountTierSchema], default: undefined },
    sizes: { type: [catalogSizeSchema], default: undefined },
    sellers: { type: [catalogSellerOfferSchema], default: undefined },
    pricing: { type: pricingSchema, required: true },
    packaging: { type: packagingSchema, default: () => ({}) },
    listNotes: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    sourceDocument: { type: String, default: "RPT PRICE LIST" },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

productSchema.index({ category: 1, sku: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ slug: 1 }, { unique: true, sparse: true });
productSchema.index({ productKind: 1, slug: 1 });
productSchema.index({ name: "text", sku: "text", description: "text" });

export default mongoose.model("Product", productSchema);
