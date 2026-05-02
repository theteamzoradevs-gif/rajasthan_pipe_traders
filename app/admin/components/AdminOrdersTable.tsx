"use client";

import { useCallback, useState } from "react";
import {
  generateQuotationPDF,
  type QuotationPdfOrderData,
} from "@/lib/utils/generateQuotationPDF";

export type AdminOrdersTableRow = {
  orderId: string;
  dateLabel: string;
  customerName: string;
  companyName: string;
  city: string;
  phone: string;
  totalLabel: string;
  pdfPayload: QuotationPdfOrderData;
};

type Props = {
  rows: AdminOrdersTableRow[];
};

const WA_MSG = encodeURIComponent(
  "Hello, thank you for your quotation request at Rajasthan Pipe Traders. How can we help you further?"
);

function whatsappDigitsForWaMe(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length >= 10) return d;
  return d;
}

export default function AdminOrdersTable({ rows }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const onViewPdf = useCallback(async (payload: QuotationPdfOrderData) => {
    setLoadingId(payload.id);
    try {
      const { blob } = await generateQuotationPDF(payload, { saveDownload: false });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        URL.revokeObjectURL(url);
        return;
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } finally {
      setLoadingId(null);
    }
  }, []);

  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-table--nowrap">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Date</th>
            <th>Customer name</th>
            <th>Company name</th>
            <th>City</th>
            <th>Phone</th>
            <th>Total amount</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted">
                No orders yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const wa = `https://wa.me/${whatsappDigitsForWaMe(r.phone)}?text=${WA_MSG}`;
              return (
                <tr key={r.pdfPayload.id}>
                  <td>
                    <span className="admin-mono">{r.orderId}</span>
                  </td>
                  <td className="muted">{r.dateLabel}</td>
                  <td>{r.customerName}</td>
                  <td className="muted">{r.companyName}</td>
                  <td className="muted">{r.city}</td>
                  <td className="muted">{r.phone}</td>
                  <td>{r.totalLabel}</td>
                  <td>
                    <div className="admin-table-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn-primary"
                        disabled={loadingId === r.pdfPayload.id}
                        onClick={() => void onViewPdf(r.pdfPayload)}
                      >
                        {loadingId === r.pdfPayload.id ? "Generating…" : "View PDF"}
                      </button>
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-btn admin-btn-ghost"
                        style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                      >
                        Message
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
