/**
 * Quotation requests from the storefront are stored as `Order` documents (collection `orders`).
 * Use `QuotationRequestModel` as the domain name; it is the same as `OrderModel`.
 */
export { OrderModel as QuotationRequestModel } from "./Order";
export type { QuotationRequestLean } from "./Order";
export type { QuotationRequest } from "../types/quotationRequest";
