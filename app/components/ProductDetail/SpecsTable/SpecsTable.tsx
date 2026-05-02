"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./SpecsTable.module.css";
import { getSellerOffers, type Product } from "../../../data/products";
import { usePricesEffectiveDate } from "@/lib/usePricesEffectiveDate";
import { listingEntryToModel } from "@/app/components/ListingMoqCartControls/ListingMoqCartControls";
import { useMoqCartForModel } from "@/lib/cart/useMoqCartForModel";

interface SpecsTableProps {
  product: Product;
  categoryProducts?: Product[];
}

type TabKey = "specs" | "terms";

const tabs: { key: TabKey; label: string }[] = [
  { key: "specs", label: "Size & Price List" },
  { key: "terms", label: "Terms & Conditions" },
];

const PAGE_SIZE = 10;

function SpecsTableRow({ p, idx }: { p: Product; idx: number }) {
  const offer = getSellerOffers(p)[0];
  const s = offer?.sizes?.[0];
  const moq = useMoqCartForModel(listingEntryToModel({ product: p, offer }));
  if (!s) return null;
  const inCart = moq.pktQty > 0 || moq.bagQty > 0;

  return (
    <tr className={idx % 2 === 0 ? styles.rowEven : styles.rowOdd}>
      <td className={styles.sizeCell}>{p.name}</td>
      <td className={styles.basicPriceCell}>₹{s.basicPrice.toFixed(2)}</td>
      <td className={styles.gstPriceCell}>₹{s.withGST.toFixed(2)}</td>
      <td className={styles.centerCell}>{s.qtyPerBag}</td>
      <td className={styles.centerCell}>{s.pcsPerPacket}</td>
      <td className={styles.actionCell}>
        <button
          type="button"
          className={`${styles.addCartBtn} ${inCart ? styles.removeCartBtn : ""}`}
          onClick={() => {
            moq.setPacketTarget(inCart ? 0 : 1);
          }}
        >
          {inCart ? "Remove from Cart" : "Add to Cart"}
        </button>
      </td>
    </tr>
  );
}

export default function SpecsTable({ product, categoryProducts = [] }: SpecsTableProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("specs");
  const pricesEffectiveDate = usePricesEffectiveDate();
  const tableProducts = categoryProducts.length > 0 ? categoryProducts : [product];
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(tableProducts.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => tableProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [tableProducts, page]
  );

  useEffect(() => {
    setPage(1);
  }, [tableProducts.length]);

  return (
    <div className={styles.container}>
      {/* Tab Bar */}
      <div className={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Size & Price List ── */}
      {activeTab === "specs" && (
        <div className={styles.tabContent}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Basic Price</th>
                  <th>Price with GST</th>
                  <th>Pkts / Master Bag</th>
                  <th>Pcs / Packet</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p, i) => (
                  <SpecsTableRow key={`${p.slug}-${i}`} p={p} idx={i} />
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((x) => Math.max(1, x - 1))}
              >
                Previous
              </button>
              <span className={styles.pageText}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage((x) => Math.min(totalPages, x + 1))}
              >
                Next
              </button>
            </div>
          ) : null}
          <p className={styles.tableNote}>
            * All prices are per packet (excluding transport).
            {pricesEffectiveDate ? ` Prices effective ${pricesEffectiveDate}.` : null}
          </p>
        </div>
      )}


      {/* ── Tab: Terms & Conditions ── */}
      {activeTab === "terms" && (
        <div className={styles.tabContent}>
          <div className={styles.termsList}>
            {[
              {
                icon: "💳",
                title: "100% Advance Payment",
                desc: "Full payment must be made in advance before dispatch of goods.",
              },
              {
                icon: "🚚",
                title: "TO PAY Transport Booking",
                desc: "Freight charges are to be borne by the buyer — all goods dispatched on TO PAY basis.",
              },
              {
                icon: "⚖️",
                title: "Subject to Ahmedabad Jurisdiction",
                desc: "All disputes are subject to the exclusive jurisdiction of courts in Ahmedabad.",
              },
              {
                icon: "🔒",
                title: "Goods Once Sold Cannot be Returned",
                desc: "No returns or exchanges once goods have been dispatched or delivered.",
              },
              {
                icon: "📋",
                title: "Price May Change Without Prior Notice",
                desc: "Prices are subject to change without any prior notice. Please confirm before ordering.",
              },
              {
                icon: "❌",
                title: "Order Cancellation",
                desc: "All existing orders will be automatically cancelled if there is any change in price. Advance payments received against such orders will be refunded accordingly.",
              },
              {
                icon: "📦",
                title: "Minimum Order Value",
                desc: `Minimum order value is ${product.minOrder} on the complete price list.`,
              },
              {
                icon: "🏷️",
                title: "Discount Policy",
                desc: "Discounts of 7%–12% are available on 15–85 cartons/bags on mix items. Only 2% discount on electric tapes, Ronela accessories, wires, and N-Star bibcock/ball valve range.",
              },
            ].map((term, i) => (
              <div key={i} className={styles.termItem}>
                <span className={styles.termIcon}>{term.icon}</span>
                <div>
                  <p className={styles.termTitle}>{term.title}</p>
                  <p className={styles.termDesc}>{term.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
