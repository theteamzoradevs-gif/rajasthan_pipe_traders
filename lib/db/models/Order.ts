import mongoose, { Schema, model, models } from "mongoose";

const orderSchema = new Schema(
  {
    /** Canonical customer name (required on new quotation requests). */
    fullName: { type: String, required: true, trim: true },
    /** Canonical phone (required on new quotation requests). */
    phoneNumber: { type: String, required: true, trim: true },
    /** @deprecated Use `fullName`; kept for older documents and API aliases. */
    customerName: { type: String, trim: true, default: "" },
    /** @deprecated Use `phoneNumber`; kept for older documents and API aliases. */
    customerPhone: { type: String, trim: true, default: "" },
    customerEmail: { type: String, trim: true, lowercase: true, default: "" },
    companyName: { type: String, trim: true },
    gstin: { type: String, trim: true },
    addressTitle: { type: String, trim: true },
    streetAddress: { type: String, trim: true },
    area: { type: String, trim: true },
    landmark: { type: String, trim: true },
    pincode: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: "India" },
    cartItems: { type: [Schema.Types.Mixed], required: true },
    totalPrice: { type: Number, required: true },
    orderSummary: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { suppressReservedKeysWarning: true }
);

/** Backfill canonical fields from legacy fields so existing rows still validate. */
orderSchema.pre("validate", function () {
  const doc = this as mongoose.Document & {
    fullName?: string;
    phoneNumber?: string;
    customerName?: string;
    customerPhone?: string;
  };
  if ((!doc.fullName || !String(doc.fullName).trim()) && doc.customerName) {
    doc.fullName = String(doc.customerName).trim();
  }
  if ((!doc.phoneNumber || !String(doc.phoneNumber).trim()) && doc.customerPhone) {
    doc.phoneNumber = String(doc.customerPhone).trim();
  }
});

orderSchema.index({ createdAt: -1 });
orderSchema.index({ customerPhone: 1, createdAt: -1 });
orderSchema.index({ phoneNumber: 1, createdAt: -1 });

if (models.Order) {
  mongoose.deleteModel("Order");
}

export const OrderModel = model("Order", orderSchema);

/** Lean document shape for quotation / order records (for typing admin + API). */
export type QuotationRequestLean = {
  _id?: unknown;
  fullName?: string;
  phoneNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  companyName?: string;
  gstin?: string;
  addressTitle?: string;
  streetAddress?: string;
  area?: string;
  landmark?: string;
  pincode?: string;
  city?: string;
  state?: string;
  country?: string;
  cartItems?: unknown[];
  totalPrice?: number;
  orderSummary?: unknown;
  createdAt?: Date;
};
