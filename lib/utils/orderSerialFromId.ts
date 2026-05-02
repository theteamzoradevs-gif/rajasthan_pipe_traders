/** Matches serial format returned with orders from `POST /api/quotation-request`. */
export function orderSerialFromMongoId(mongoId: string): string {
  return `RPT-${mongoId.replace(/[^a-f0-9]/gi, "").slice(-6).toUpperCase()}`;
}
