"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./CartItemCard.module.css";
import type { AddCartItemInput, CartItem } from "../../../context/CartWishlistContext";
import {
  normalizeOrderMode,
  pricedPacketCount,
  totalPiecesForLine,
  type CartOrderMode,
} from "@/lib/cart/packetLine";
import { resolvePackingLabelsForCartLine } from "@/lib/packingLabels";
import { productHeading, brandPillLabel, resolveBrandPillVariant } from "../../../lib/productHeading";
import listingMoqStyles from "@/app/components/ListingMoqCartControls/ListingMoqCartControls.module.css";
import { useLeadGate } from "@/app/context/LeadPhoneContext";

interface CartItemCardProps {
  /** One or two lines (packets + optional bulk) merged into one card */
  lines: CartItem[];
  removeFromCart: (productId: number, size: string, sellerId: string, orderMode?: CartItem["orderMode"]) => void;
  removeCartGroup: (productId: number, size: string, sellerId: string) => void;
  updateQuantity: (productId: number, size: string, qty: number, sellerId: string, orderMode?: CartItem["orderMode"]) => void;
  addToCart: (item: AddCartItemInput, qty?: number) => boolean;
}

function formatPieces(n: number) {
  return n.toLocaleString("en-IN");
}

function lineToPayload(line: CartItem, orderMode: CartOrderMode): AddCartItemInput {
  return {
    productId: line.productId,
    mongoProductId: line.mongoProductId,
    categoryMongoId: line.categoryMongoId,
    productSlug: line.productSlug,
    productImage: line.productImage,
    productName: line.productName,
    brand: line.brand,
    category: line.category,
    sellerId: line.sellerId,
    sellerName: line.sellerName,
    size: line.size,
    pricePerUnit: line.pricePerUnit,
    basicPricePerUnit: line.basicPricePerUnit,
    qtyPerBag: line.qtyPerBag,
    pcsPerPacket: line.pcsPerPacket,
    orderMode,
    ...(line.comboPricedPackets != null ? { comboPricedPackets: line.comboPricedPackets } : {}),
  };
}

export default function CartItemCard({
  lines,
  removeFromCart,
  removeCartGroup,
  updateQuantity,
  addToCart,
}: CartItemCardProps) {
  const { withLead } = useLeadGate();
  const add = React.useCallback(
    (item: AddCartItemInput, qty?: number) => {
      withLead(() => {
        addToCart(item, qty);
      });
    },
    [withLead, addToCart]
  );
  const base = lines[0];
  const labels = resolvePackingLabelsForCartLine(base);
  const hasBulk = Number(base.qtyPerBag) > 0;

  const packetLine = lines.find((l) => normalizeOrderMode(l.orderMode) === "packets");
  const bagLine = lines.find((l) => normalizeOrderMode(l.orderMode) === "master_bag");

  const pktQtyRaw = packetLine ? Number(packetLine.quantity) || 0 : 0;
  const bagQtyRaw = bagLine ? Number(bagLine.quantity) || 0 : 0;
  const qpb = Math.max(0, Math.floor(Number(base.qtyPerBag) || 0));
  const pktQty = hasBulk && qpb > 0 ? (pktQtyRaw > 0 ? pktQtyRaw : bagQtyRaw * qpb) : pktQtyRaw;
  const bagQty = hasBulk && qpb > 0 ? Math.floor(pktQty / qpb + 1e-9) : bagQtyRaw;

  /** Unit row for display: bag line when user has bags (carries combo-updated price); else first line. */
  const unitDisplayLine = bagLine && bagQty > 0 ? bagLine : base;
  const safePrice = Number(unitDisplayLine.pricePerUnit) || 0;
  const safeBasic = Number(unitDisplayLine.basicPricePerUnit) || 0;

  const combinedLineTotal = lines.reduce(
    (sum, l) => sum + (Number(l.pricePerUnit) || 0) * pricedPacketCount(l),
    0
  );
  const combinedBasic = lines.reduce(
    (sum, l) => sum + (Number(l.basicPricePerUnit) || 0) * pricedPacketCount(l),
    0
  );
  const gstAmount = combinedLineTotal - combinedBasic;

  const combinedPacketCount = lines.reduce((sum, l) => sum + pricedPacketCount(l), 0);
  const combinedPieces = lines.reduce((sum, l) => sum + totalPiecesForLine(l), 0);
  const comboPacketsOnCard = lines.reduce((sum, l) => sum + (l.comboPricedPackets ?? 0), 0);
  const comboGstOnCard = lines.reduce((sum, l) => sum + (l.comboSubtotalInclGst ?? 0), 0);
  /** Match CartWishlistContext + ComboCartPricingSync: combo can be inferred from packets, GST slice, or flag. */
  const comboPriceApplied =
    comboPacketsOnCard > 0 ||
    comboGstOnCard > 0.005 ||
    lines.some((l) => Boolean(l.isComboApplied));

  /** Set by `/api/cart/combo-pricing` when this line uses RPT combo net pricing (incl. bag-only lines). */
  const showComboBadge = comboPriceApplied;

  const mrpUnit = safePrice * 1.15;
  const mrpTotal = mrpUnit * combinedPacketCount;
  const saving = mrpTotal - combinedLineTotal;
  const savePct = mrpUnit > 0 ? Math.round(((mrpUnit - safePrice) / mrpUnit) * 100) : 0;

  const setPacketQty = (next: number) => {
    if (next < 0) return;
    if (hasBulk && qpb > 0) {
      if (next === 0) {
        if (packetLine) removeFromCart(base.productId, base.size, base.sellerId, "packets");
        if (bagLine) removeFromCart(base.productId, base.size, base.sellerId, "master_bag");
        return;
      }
      if (!packetLine) {
        add(lineToPayload(base, "packets"), next);
      } else {
        updateQuantity(base.productId, base.size, next, base.sellerId, "packets");
      }
      if (bagLine) {
        removeFromCart(base.productId, base.size, base.sellerId, "master_bag");
      }
      return;
    }
    if (next === 0) {
      if (packetLine) removeFromCart(base.productId, base.size, base.sellerId, "packets");
      return;
    }
    if (!packetLine) {
      add(lineToPayload(base, "packets"), next);
    } else {
      updateQuantity(base.productId, base.size, next, base.sellerId, "packets");
    }
  };

  const setBagQty = (next: number) => {
    if (next < 0) return;
    if (hasBulk && qpb > 0) {
      setPacketQty(next * qpb);
      return;
    }
    if (next === 0) {
      if (bagLine) removeFromCart(base.productId, base.size, base.sellerId, "master_bag");
      return;
    }
    if (!bagLine) {
      add(lineToPayload(base, "master_bag"), next);
    } else {
      updateQuantity(base.productId, base.size, next, base.sellerId, "master_bag");
    }
  };

  const [pktInput, setPktInput] = useState(String(pktQty));
  const [bagInput, setBagInput] = useState(String(bagQty));

  useEffect(() => {
    setPktInput(String(pktQty));
  }, [pktQty]);

  useEffect(() => {
    setBagInput(String(bagQty));
  }, [bagQty]);

  const commitPkt = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 0) {
      setPacketQty(n);
    } else {
      setPktInput(String(pktQty));
    }
  };

  const commitBag = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 0) {
      setBagQty(n);
    } else {
      setBagInput(String(bagQty));
    }
  };

  const pkFromBags = bagLine ? pricedPacketCount(bagLine) : 0;
  const pkLoose = packetLine ? pricedPacketCount(packetLine) : 0;

  const brandSource = (base.brand ?? "").trim();
  const pillLabel = brandPillLabel(brandSource);
  const pillVariant = resolveBrandPillVariant(brandSource);
  const listingBrandPillClass =
    pillVariant === "hitech"
      ? styles.listingBrandHitech
      : pillVariant === "tejas"
        ? styles.listingBrandTejas
        : pillVariant === "nstar"
          ? styles.listingBrandNstar
          : styles.listingBrandDefault;

  const qtySummaryText = (() => {
    if (hasBulk && bagQty > 0 && pktQty > 0) {
      const outerWord = bagQty === 1 ? labels.outer : labels.outerPlural;
      return `${bagQty} ${outerWord} = ${combinedPacketCount} ${labels.innerPlural}.`;
    }
    if (hasBulk && bagQty > 0 && pktQty === 0) {
      const outerWord = bagQty === 1 ? labels.outer : labels.outerPlural;
      return `${bagQty} ${outerWord} = ${pkFromBags} ${labels.innerPlural} = ${formatPieces(combinedPieces)} pcs`;
    }
    if (pktQty > 0 && packetLine) {
      return `${pkLoose} ${labels.innerPlural} (${formatPieces(totalPiecesForLine(packetLine))} pc)`;
    }
    return `${combinedPacketCount} ${labels.innerPlural} (${formatPieces(combinedPieces)} pc)`;
  })();

  return (
    <div className={styles.card}>
      <Link href={`/products/${base.productSlug}`} className={styles.imageWrap}>
        <Image
          src={base.productImage}
          alt={base.productName}
          fill
          sizes="96px"
          style={{ objectFit: "contain", padding: "0.5rem" }}
        />
      </Link>

      <div className={styles.detailsCol}>
        <div className={styles.topRow}>
          <div className={styles.nameGroup}>
            <div className={styles.nameRow}>
              <Link href={`/products/${base.productSlug}`} className={styles.name}>
                {base.productName}
              </Link>
              {showComboBadge ? (
                <span className={styles.comboBadge} title="RPT Patti + core combo net rate on this line">
                  COMBO PRICE APPLIED
                </span>
              ) : null}
            </div>
            <div className={styles.categoryRow}>
              <span className={styles.category}>{base.category}</span>
              {pillLabel ? (
                <span className={`${styles.listingBrand} ${listingBrandPillClass}`}>{pillLabel}</span>
              ) : null}
            </div>
            {base.sellerId !== "default" && <span className={styles.sellerLine}>Seller: {base.sellerName}</span>}
            {showComboBadge ? (
              <p className={styles.comboInlineMsg}>
                🎉 Combo Offer Lag Gaya! Ab is product ka rate sirf ₹{safePrice.toFixed(2)} / {labels.inner} hai.
                👉 Total amount: ₹{combinedLineTotal.toFixed(2)}.
              </p>
            ) : null}
          </div>
          <button
            className={styles.removeBtn}
            onClick={() => removeCartGroup(base.productId, base.size, base.sellerId)}
            aria-label="Remove product from cart"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>

        <div className={styles.metaControlsRow}>
          <div className={styles.cartUnitQtyMeta}>
            <div className={styles.cartMetaRow}>
              <span className={styles.cartMetaLabel}>Unit price</span>
              <div className={styles.pricingValues}>
                <span className={styles.strike}>₹{mrpUnit.toFixed(2)}</span>
                <span className={styles.priceMain}>₹{safePrice.toFixed(2)}</span>
              </div>
            </div>
            <div className={styles.cartMetaRow}>
              <span className={styles.cartMetaLabel}>Quantity</span>
              <p className={styles.qtySummaryLine}>{qtySummaryText}</p>
            </div>
          </div>
          <div className={styles.cartControlsCol}>
            <div
              className={`${listingMoqStyles.root} ${listingMoqStyles.cardListingLayout} ${listingMoqStyles.cartCardListing} ${styles.cartMoqRoot}`}
            >
              {hasBulk ? (
                <div className={listingMoqStyles.bulkRows}>
                  <div className={listingMoqStyles.cardListingOuterBox}>
                    <div className={`${listingMoqStyles.stepper} ${listingMoqStyles.stepperCardListing}`}>
                      <button
                        type="button"
                        className={listingMoqStyles.stepBtn}
                        onClick={() => setBagQty(Math.max(0, bagQty - 1))}
                        disabled={bagQty <= 0}
                        aria-label={`Decrease ${labels.outerPlural}`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className={listingMoqStyles.stepInput}
                        value={bagInput}
                        min={0}
                        step={1}
                        onChange={(e) => setBagInput(e.target.value)}
                        onBlur={(e) => commitBag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        aria-label={`Quantity in ${labels.outerPlural}`}
                      />
                      <button type="button" className={listingMoqStyles.stepBtn} onClick={() => setBagQty(bagQty + 1)} aria-label={`Increase ${labels.outerPlural}`}>
                        +
                      </button>
                      <span className={listingMoqStyles.cardListingUnitChip}>{labels.outerPlural}</span>
                    </div>
                  </div>
                  <div className={listingMoqStyles.cardListingOuterBox}>
                    <div className={`${listingMoqStyles.stepper} ${listingMoqStyles.stepperCardListing}`}>
                      <button
                        type="button"
                        className={listingMoqStyles.stepBtn}
                        onClick={() =>
                          qpb > 0 ? setPacketQty(Math.max(0, pktQty - qpb)) : setPacketQty(Math.max(0, pktQty - 1))
                        }
                        disabled={pktQty <= 0}
                        aria-label={qpb > 0 ? `Decrease packets by ${qpb}` : "Decrease packets"}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className={listingMoqStyles.stepInput}
                        value={pktInput}
                        min={0}
                        step={1}
                        onChange={(e) => setPktInput(e.target.value)}
                        onBlur={(e) => commitPkt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        aria-label={
                          qpb > 0
                            ? `Quantity in ${labels.innerPlural}; +/- buttons change by ${qpb}`
                            : `Quantity in ${labels.innerPlural}`
                        }
                      />
                      <button
                        type="button"
                        className={listingMoqStyles.stepBtn}
                        onClick={() => (qpb > 0 ? setPacketQty(pktQty + qpb) : setPacketQty(pktQty + 1))}
                        aria-label={qpb > 0 ? `Increase packets by ${qpb}` : "Increase packets"}
                      >
                        +
                      </button>
                      <span className={listingMoqStyles.cardListingUnitChip}>{labels.innerPlural}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={listingMoqStyles.cardListingOuterBox}>
                  <div className={`${listingMoqStyles.stepper} ${listingMoqStyles.stepperCardListing}`}>
                    <button
                      type="button"
                      className={listingMoqStyles.stepBtn}
                      onClick={() => setPacketQty(Math.max(0, pktQty - 1))}
                      disabled={pktQty <= 0}
                      aria-label="Decrease packets"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className={listingMoqStyles.stepInput}
                      value={pktInput}
                      min={0}
                      step={1}
                      onChange={(e) => setPktInput(e.target.value)}
                      onBlur={(e) => commitPkt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      aria-label={`Quantity in ${labels.innerPlural}`}
                    />
                    <button type="button" className={listingMoqStyles.stepBtn} onClick={() => setPacketQty(pktQty + 1)} aria-label="Increase packets">
                      +
                    </button>
                    <span className={listingMoqStyles.cardListingUnitChip}>{labels.innerPlural}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.pricingCol}>
        <div className={styles.pricingRow}>
          <span className={styles.pricingLabel}>Total</span>
          <div className={styles.pricingValues}>
            <span className={styles.strike}>₹{mrpTotal.toFixed(2)}</span>
            <span className={styles.totalMain}>
              ₹{combinedLineTotal.toFixed(2)}
              {showComboBadge ? (
                <span
                  className={styles.comboPriceAppliedBadge}
                  title="RPT Patti + core combo pricing in the same category (20/25MM clip lines)"
                >
                  COMBO PRICE APPLIED
                </span>
              ) : null}
            </span>
            <span className={styles.gstNote}>Basic price · ₹{combinedBasic.toFixed(2)}</span>
            <span className={styles.gstNote}>Including GST · ₹{gstAmount.toFixed(2)}</span>
          </div>
        </div>

        <span className={styles.savingBadge}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          Save {savePct}% · ₹{saving.toFixed(0)} off
        </span>
      </div>
    </div>
  );
}
