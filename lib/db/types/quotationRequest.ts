/**
 * Storefront quotation request fields (persisted as `Order` in MongoDB).
 * Only `fullName` and `phoneNumber` are required on create; all others optional.
 */
export interface QuotationRequest {
  fullName: string;
  phoneNumber: string;
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
  /** Defaults to `"India"` in the schema when omitted. */
  country?: string;
  cartItems: unknown[];
  totalPrice: number;
  orderSummary?: Record<string, unknown>;
  /** Legacy mirror of `fullName` (older rows / API alias). */
  customerName?: string;
  /** Legacy mirror of `phoneNumber` (older rows / API alias). */
  customerPhone?: string;
}
