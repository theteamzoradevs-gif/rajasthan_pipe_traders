"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCartWishlist } from "@/app/context/CartWishlistContext";
import { pricedPacketCount } from "@/lib/cart/packetLine";
import {
  comboQualifyingTriggersSectionHeading,
  shouldHideComboTargetPdpNotice,
  type ComboTargetAddBlockedInfo,
} from "@/lib/combo/comboAddGuard";
import styles from "./ProductDetail.module.css";

function titleCaseFromSlug(slug: string): string {
  const s = slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return s || slug;
}

type Props = {
  productSlug: string;
  info: ComboTargetAddBlockedInfo;
};

export default function ComboTargetPdpNotice({ productSlug, info }: Props) {
  const { cartItems, cartHydrated, comboGuardRules } = useCartWishlist();
  const [showAllTriggersModal, setShowAllTriggersModal] = useState(false);

  const normalizedProductSlug = productSlug.trim().toLowerCase();
  const lines = useMemo(
    () =>
      cartItems.map((ci) => ({
        productSlug: ci.productSlug,
        quantity: ci.quantity,
        orderMode: ci.orderMode,
        qtyPerBag: ci.qtyPerBag,
        pcsPerPacket: ci.pcsPerPacket,
        packetsPerCarton: ci.packetsPerCarton,
      })),
    [cartItems]
  );

  const conditionMet =
    cartHydrated &&
    comboGuardRules != null &&
    shouldHideComboTargetPdpNotice(productSlug, lines, comboGuardRules);

  const targetLinesInCart = useMemo(
    () =>
      cartItems.filter((ci) => {
        const s = typeof ci.productSlug === "string" ? ci.productSlug.trim().toLowerCase() : "";
        return s === normalizedProductSlug;
      }),
    [cartItems, normalizedProductSlug]
  );

  const targetInCart = targetLinesInCart.length > 0;
  const targetLineTotal = targetLinesInCart.reduce((sum, l) => sum + l.pricePerUnit * pricedPacketCount(l), 0);
  const comboLineForUnit =
    targetLinesInCart.find((l) => (l.comboPricedPackets ?? 0) > 0 || l.isComboApplied) ?? targetLinesInCart[0];
  const comboNetUnit = comboLineForUnit?.pricePerUnit ?? null;

  const shouldUseTriggerModal = !conditionMet && info.qualifyingProductSlugs.length > 5;
  const shown = shouldUseTriggerModal
    ? info.qualifyingProductSlugs.slice(0, 5)
    : info.qualifyingProductSlugs.slice(0, 12);
  const rest = info.qualifyingProductSlugs.length - shown.length;

  const isClaimedState = conditionMet && targetInCart;
  const triggerCount = info.qualifyingProductSlugs.length;
  const lockedComboMessage =
    triggerCount > 1
      ? "Yeh combo product hai. 👉 Isse lene ke liye pehle ek aur product add karna zaroori hai. 👉 Neeche se koi bhi item add karein."
      : "Yeh combo product hai. 👉 Isse lene ke liye pehle ek aur product add karna zaroori hai. 👉 Neeche se item add karein.";

  return (
    <aside
      className={`${styles.comboPdpNotice} ${isClaimedState ? styles.comboPdpNoticeSuccess : ""}`}
      aria-label="Combo offer — how to add to cart"
    >
      <div className={styles.comboPdpNoticeIcon} aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path
            d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className={styles.comboPdpNoticeBody}>
        {conditionMet ? (
          targetInCart ? (
            <p className={styles.comboPdpNoticeLead}>
              🎉 Combo Offer Lag Gaya!
              {comboNetUnit != null ? ` Ab is product ka rate sirf ₹${comboNetUnit.toFixed(2)} / packet hai.` : ""}
              {` 👉 Total amount: ₹${targetLineTotal.toFixed(2)}.`}
            </p>
          ) : (
            <div>
              <p className={styles.comboPdpNoticeLead}>
                You can buy this product now. Aap qualifying condition meet kar chuke ho, isliye combo offer apply ho
                sakta hai.
              </p>
            </div>
          )
        ) : (
          <p className={styles.comboPdpNoticeLead}>{lockedComboMessage}</p>
        )}
        {!conditionMet && shown.length > 0 ? (
          <div className={styles.comboPdpNoticeLinksWrap}>
            <span className={styles.comboPdpNoticeLinksLabel}>
              {comboQualifyingTriggersSectionHeading(info.qualifyingProductSlugs.length)}
            </span>
            <nav className={styles.comboPdpNoticeLinks} aria-label="Qualifying product pages">
              {shown.map((slug) => (
                <Link
                  key={slug}
                  href={`/products/${encodeURIComponent(slug)}`}
                  prefetch={false}
                  className={styles.comboPdpNoticeLink}
                >
                  {titleCaseFromSlug(slug)}
                </Link>
              ))}
            </nav>
            {shouldUseTriggerModal ? (
              <button
                type="button"
                className={styles.comboPdpNoticeViewAllBtn}
                onClick={() => setShowAllTriggersModal(true)}
              >
                See all qualifying products
              </button>
            ) : null}
            {rest > 0 ? (
              <p className={styles.comboPdpNoticeMore}>
                +{rest} aur qualifying {rest === 1 ? "product" : "products"} is offer mein — catalog ya search se dekh
                sakte ho.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {showAllTriggersModal ? (
        <div
          className={styles.comboPdpModalBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAllTriggersModal(false);
          }}
        >
          <div className={styles.comboPdpModal} role="dialog" aria-modal="true" aria-label="All qualifying products">
            <div className={styles.comboPdpModalHeader}>
              <h3 className={styles.comboPdpModalTitle}>All qualifying products</h3>
              <button
                type="button"
                className={styles.comboPdpModalClose}
                onClick={() => setShowAllTriggersModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className={styles.comboPdpModalBody}>
              {info.qualifyingProductSlugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/products/${encodeURIComponent(slug)}`}
                  prefetch={false}
                  className={styles.comboPdpNoticeLink}
                  onClick={() => setShowAllTriggersModal(false)}
                >
                  {titleCaseFromSlug(slug)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
