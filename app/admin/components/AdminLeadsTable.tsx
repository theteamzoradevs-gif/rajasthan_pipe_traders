"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type AdminLeadCartLine = {
  productName: string;
  size: string;
  quantityLabel: string;
};

export type AdminLeadsTableRow = {
  id: string;
  phone: string;
  /** From latest matching `Order.customerPhone` in DB when status is ordered. */
  orderPhone?: string;
  /** From the same order row as `orderPhone` (`Order.customerName`). */
  orderCustomerName?: string;
  dateLabel: string;
  status: "ordered" | "non-ordered";
  cartLines: AdminLeadCartLine[];
};

type Props = {
  rows: AdminLeadsTableRow[];
};

function normalizePhone(s: string) {
  return s.replace(/\D/g, "");
}

const WA_MSG = encodeURIComponent(
  "Hello, thank you for your quotation request at Rajasthan Pipe Traders. How can we help you further?"
);

function whatsappDigitsForWaMe(phone: string): string {
  const d = normalizePhone(phone);
  if (d.length === 10) return `91${d}`;
  if (d.length >= 10) return d;
  return d;
}

type Selected = AdminLeadsTableRow | null;

export default function AdminLeadsTable({ rows }: Props) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Selected>(null);

  const filtered = useMemo(() => {
    const raw = q.trim();
    if (!raw) return rows;
    const digits = normalizePhone(raw);
    return rows.filter((r) => {
      const p = r.phone;
      if (digits.length > 0) {
        return (
          normalizePhone(p).includes(digits) ||
          (r.orderPhone ? normalizePhone(r.orderPhone).includes(digits) : false)
        );
      }
      const low = raw.toLowerCase();
      return (
        p.toLowerCase().includes(low) ||
        (r.orderPhone ? r.orderPhone.toLowerCase().includes(low) : false) ||
        (r.orderCustomerName ? r.orderCustomerName.toLowerCase().includes(low) : false)
      );
    });
  }, [rows, q]);

  const close = useCallback(() => setSelected(null), []);

  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, close]);

  const onRowActivate = (r: AdminLeadsTableRow) => {
    setSelected(r);
  };

  const waForSelected = selected ? `https://wa.me/${whatsappDigitsForWaMe(selected.phone)}?text=${WA_MSG}` : "";

  return (
    <div>
      <div className="admin-toolbar">
        <div className="admin-toolbar-search">
          <label className="admin-sr-only" htmlFor="admin-leads-phone-filter">
            Filter by phone number
          </label>
          <div className="admin-search-block">
            <svg className="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              id="admin-leads-phone-filter"
              type="search"
              className="admin-search-input"
              placeholder="Search by phone number…"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q.trim() ? (
              <button
                type="button"
                className="admin-search-clear"
                aria-label="Clear search"
                onClick={() => setQ("")}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table admin-table--nowrap">
          <thead>
            <tr>
              <th>Phone number</th>
              <th>Name</th>
              <th>Order phone</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {rows.length === 0 ? "No leads yet." : "No leads match this phone search."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="admin-table-row-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => onRowActivate(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowActivate(r);
                    }
                  }}
                >
                  <td>{r.phone}</td>
                  <td className="muted">
                    {r.status === "ordered" && r.orderCustomerName ? r.orderCustomerName : "—"}
                  </td>
                  <td className="muted">
                    {r.status === "ordered" && r.orderPhone ? r.orderPhone : "—"}
                  </td>
                  <td className="muted">{r.dateLabel}</td>
                  <td>
                    {r.status === "ordered" ? (
                      <span className="admin-tag admin-tag--success">Ordered</span>
                    ) : (
                      <span className="admin-tag admin-tag--muted">Non-Ordered</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) close();
          }}
        >
          <div className="admin-modal wide" role="dialog" aria-modal="true" aria-labelledby="admin-lead-modal-title">
            <h2 id="admin-lead-modal-title">Lead details</h2>

            <div className="admin-field" style={{ marginBottom: "0.75rem" }}>
              <div className="admin-form-section-title">Contact</div>
              <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{selected.phone}</p>
              {selected.status === "ordered" && selected.orderCustomerName ? (
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.95rem", color: "var(--admin-muted, #64748b)" }}>
                  Name: <span style={{ fontWeight: 600, color: "inherit" }}>{selected.orderCustomerName}</span>
                </p>
              ) : null}
              {selected.status === "ordered" && selected.orderPhone ? (
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.95rem", color: "var(--admin-muted, #64748b)" }}>
                  Order phone: <span style={{ fontWeight: 600, color: "inherit" }}>{selected.orderPhone}</span>
                </p>
              ) : null}
            </div>

            <div className="admin-field" style={{ marginBottom: "1rem" }}>
              <div className="admin-form-section-title">Current status</div>
              <p style={{ margin: 0 }}>
                {selected.status === "ordered" ? (
                  <span className="admin-tag admin-tag--success">Ordered</span>
                ) : (
                  <span className="admin-tag admin-tag--muted">Non-Ordered</span>
                )}
              </p>
            </div>

            <div className="admin-form-section-title" style={{ marginBottom: "0.5rem" }}>
              Cart activity
            </div>
            {selected.cartLines.length === 0 ? (
              <p className="muted" style={{ margin: "0 0 1rem" }}>
                No cart items stored for this lead.
              </p>
            ) : (
              <div className="admin-table-wrap" style={{ marginBottom: "1rem" }}>
                <table className="admin-table admin-table--nowrap">
                  <thead>
                    <tr>
                      <th>Product name</th>
                      <th>Size</th>
                      <th>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.cartLines.map((line, idx) => (
                      <tr key={`${selected.id}-cart-${idx}`}>
                        <td>{line.productName}</td>
                        <td className="muted">{line.size}</td>
                        <td className="muted">{line.quantityLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="admin-modal-actions">
              <a
                href={waForSelected}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn admin-btn-primary"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                onClick={(e) => e.stopPropagation()}
              >
                Message on WhatsApp
              </a>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={close}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
