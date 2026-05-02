import { connectDb } from "@/lib/db/connect";
import { OrderModel } from "@/lib/db/models/Order";
import { orderSerialFromMongoId } from "@/lib/utils/orderSerialFromId";
import { formatAdminDateTime } from "@/lib/utils/formatAdminDateTime";
import type { QuotationPdfOrderData } from "@/lib/utils/generateQuotationPDF";
import AdminOrdersTable, { type AdminOrdersTableRow } from "../components/AdminOrdersTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    n
  );
}

function toPdfPayload(
  o: {
    _id: unknown;
    createdAt?: Date;
    fullName?: string;
    phoneNumber?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    companyName?: string | null;
    gstin?: string | null;
    streetAddress?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    totalPrice?: number;
    orderSummary?: unknown;
    cartItems?: unknown;
  },
  id: string
): QuotationPdfOrderData {
  const cAt = o.createdAt instanceof Date ? o.createdAt : new Date();
  const orderSummary =
    o.orderSummary && typeof o.orderSummary === "object" && !Array.isArray(o.orderSummary)
      ? (o.orderSummary as QuotationPdfOrderData["orderSummary"])
      : {};
  const cartItems = Array.isArray(o.cartItems) ? o.cartItems : [];
  const name =
    (typeof o.fullName === "string" && o.fullName.trim() ? o.fullName : "") ||
    (typeof o.customerName === "string" ? o.customerName : "");
  const phone =
    (typeof o.phoneNumber === "string" && o.phoneNumber.trim() ? o.phoneNumber : "") ||
    (typeof o.customerPhone === "string" ? o.customerPhone : "");
  return {
    id,
    serialNo: orderSerialFromMongoId(id),
    createdAt: cAt.toISOString(),
    fullName: typeof o.fullName === "string" ? o.fullName : "",
    customerName: name,
    customerPhone: phone,
    customerEmail: typeof o.customerEmail === "string" ? o.customerEmail : "",
    companyName: typeof o.companyName === "string" ? o.companyName : "",
    gstin: typeof o.gstin === "string" ? o.gstin : "",
    streetAddress: typeof o.streetAddress === "string" ? o.streetAddress : "",
    city: typeof o.city === "string" ? o.city : "",
    state: typeof o.state === "string" ? o.state : "",
    pincode: typeof o.pincode === "string" ? o.pincode : "",
    totalPrice: typeof o.totalPrice === "number" && Number.isFinite(o.totalPrice) ? o.totalPrice : 0,
    orderSummary,
    cartItems: cartItems as QuotationPdfOrderData["cartItems"],
  };
}

export default async function AdminOrdersPage() {
  await connectDb();
  const orders = await OrderModel.find({})
    .sort({ createdAt: -1 })
    .limit(500)
    .lean()
    .exec();

  const rows: AdminOrdersTableRow[] = orders.map((o) => {
    const id = String(o._id);
    const created = o.createdAt instanceof Date ? o.createdAt : new Date();
    const total = typeof o.totalPrice === "number" && Number.isFinite(o.totalPrice) ? o.totalPrice : 0;
    const name =
      (typeof o.fullName === "string" && o.fullName.trim() ? o.fullName : "") ||
      (typeof o.customerName === "string" && o.customerName.trim() ? o.customerName : "—");
    const phone =
      (typeof o.phoneNumber === "string" && o.phoneNumber.trim() ? o.phoneNumber : "") ||
      (typeof o.customerPhone === "string" && o.customerPhone.trim() ? o.customerPhone : "—");
    const companyName =
      typeof o.companyName === "string" && o.companyName.trim() ? o.companyName.trim() : "—";
    const city = typeof o.city === "string" && o.city.trim() ? o.city.trim() : "—";
    return {
      orderId: orderSerialFromMongoId(id),
      dateLabel: formatAdminDateTime(created),
      customerName: name,
      companyName,
      city,
      phone,
      totalLabel: formatInr(total),
      pdfPayload: toPdfPayload(o, id),
    };
  });

  return (
    <div className="admin-root">
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 className="admin-dashboard-title" style={{ margin: 0 }}>
          Orders
        </h1>
        <p className="admin-dashboard-lead" style={{ margin: "0.5rem 0 0" }}>
          All quotation and checkout records ({rows.length} shown, newest first). Use View PDF to open the same invoice in
          a new tab (you can download it from the browser viewer).
        </p>
      </header>

      <AdminOrdersTable rows={rows} />
    </div>
  );
}
