import { connectDb } from "@/lib/db/connect";
import { LeadModel } from "@/lib/db/models/Lead";
import type { LeadStatus } from "@/lib/db/models/Lead";
import { OrderModel } from "@/lib/db/models/Order";
import { last10PhoneKey } from "@/lib/phone/last10PhoneKey";
import { formatAdminDateTime } from "@/lib/utils/formatAdminDateTime";
import AdminLeadsTable, { type AdminLeadCartLine, type AdminLeadsTableRow } from "../components/AdminLeadsTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toRowStatus(s: unknown): LeadStatus {
  return s === "ordered" ? "ordered" : "non-ordered";
}

function parseCartLines(raw: unknown): AdminLeadCartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const o = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
    const productName = typeof o.productName === "string" && o.productName.trim() ? o.productName : "—";
    const size = typeof o.size === "string" && o.size.trim() ? o.size : "—";
    let quantityLabel: string;
    if (typeof o.quantity === "number" && Number.isFinite(o.quantity)) {
      quantityLabel = String(o.quantity);
    } else if (typeof o.quantity === "string" && o.quantity.trim()) {
      quantityLabel = o.quantity;
    } else {
      quantityLabel = "—";
    }
    return { productName, size, quantityLabel };
  });
}

export default async function AdminLeadsPage() {
  await connectDb();
  const [leads, orders] = await Promise.all([
    LeadModel.find({})
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean()
      .exec(),
    OrderModel.find({})
      .sort({ createdAt: -1 })
      .select("customerPhone customerName phoneNumber fullName")
      .limit(10000)
      .lean()
      .exec(),
  ]);

  /** Most recent order per 10-digit key: phone + name from that order. */
  const orderPhoneByKey = new Map<string, string>();
  const orderNameByKey = new Map<string, string>();
  for (const o of orders) {
    const raw =
      (typeof o.phoneNumber === "string" ? o.phoneNumber.trim() : "") ||
      (typeof o.customerPhone === "string" ? o.customerPhone.trim() : "");
    if (!raw) continue;
    const k = last10PhoneKey(raw);
    if (k.length < 10) continue;
    if (!orderPhoneByKey.has(k)) {
      orderPhoneByKey.set(k, raw);
      const name =
        (typeof o.fullName === "string" ? o.fullName.trim() : "") ||
        (typeof o.customerName === "string" ? o.customerName.trim() : "");
      orderNameByKey.set(k, name);
    }
  }

  const rows: AdminLeadsTableRow[] = leads.map((l) => {
    const id = String(l._id);
    const created = l.createdAt instanceof Date ? l.createdAt : new Date();
    const leadPhone = typeof l.phone === "string" ? l.phone : "—";
    const status = toRowStatus(l.status);
    const key = leadPhone !== "—" ? last10PhoneKey(leadPhone) : "";
    const orderPhone =
      status === "ordered" && key.length >= 10 ? (orderPhoneByKey.get(key) ?? "") : "";
    const orderCustomerName =
      status === "ordered" && key.length >= 10 ? (orderNameByKey.get(key) ?? "") : "";

    return {
      id,
      phone: leadPhone,
      orderPhone: orderPhone || undefined,
      orderCustomerName: orderCustomerName || undefined,
      dateLabel: formatAdminDateTime(created),
      status,
      cartLines: parseCartLines(l.itemsInCart),
    };
  });

  return (
    <div className="admin-root">
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 className="admin-dashboard-title" style={{ margin: 0 }}>
          Leads
        </h1>
        <p className="admin-dashboard-lead" style={{ margin: "0.5rem 0 0" }}>
          Everyone who entered a phone number ({rows.length} records). Search updates as you type. Click a row for full
          details.
        </p>
      </header>

      <AdminLeadsTable rows={rows} />
    </div>
  );
}
