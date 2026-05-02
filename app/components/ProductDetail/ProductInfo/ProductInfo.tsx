"use client";

import React, { useMemo, useState } from "react";
import { productHeading, brandPillLabel, resolveBrandPillVariant } from "../../../lib/productHeading";
import styles from "./ProductInfo.module.css";
import {
  getSellerOffers,
  type KeyFeatureIcon,
  type Product,
  resolveKeyFeaturesForDisplay,
} from "../../../data/products";
import { renderKeyFeatureRichText } from "@/app/lib/keyFeatureText";
import { resolvePackingUnitLabels } from "@/lib/packingLabels";
import type { ListingMoqCartModel } from "@/lib/cart/listingMoqModel";
import { useMoqCartForModel } from "@/lib/cart/useMoqCartForModel";
import { ListingMoqCartControlsView } from "@/app/components/ListingMoqCartControls/ListingMoqCartControls";
import listingMoqStyles from "@/app/components/ListingMoqCartControls/ListingMoqCartControls.module.css";
import { usePricesEffectiveDate } from "@/lib/usePricesEffectiveDate";

interface ProductInfoProps {
  product: Product;
}

function KeyFeatureLineIcon({ icon }: { icon: KeyFeatureIcon }) {
  if (icon === "material") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    );
  }
  if (icon === "dot") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#64748b" aria-hidden>
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" aria-hidden>
      <path d="M20 7 9 18l-5-5" />
    </svg>
  );
}

const VARIANT_PILL_COLORS: Record<ReturnType<typeof resolveBrandPillVariant>, string> = {
  hitech: "#7c3aed",
  tejas: "#2563eb",
  nstar: "#059669",
  default: "#7c3aed",
};

export default function ProductInfo({ product }: ProductInfoProps) {
  const offers = getSellerOffers(product);
  const [sellerIdx, setSellerIdx] = useState(0);
  const [selectedSizeIndex] = useState(0);
  const pricesEffectiveDate = usePricesEffectiveDate();

  const activeOffer = offers[sellerIdx];
  const brandDisplay = brandPillLabel(product.brand || activeOffer.brand);
  const brandPillColor = VARIANT_PILL_COLORS[resolveBrandPillVariant(brandDisplay)];
  const selectedSize = activeOffer.sizes[selectedSizeIndex];
  const labels = resolvePackingUnitLabels(product, selectedSize);
  const hasBulk = selectedSize.qtyPerBag > 0;

  const moqModel = useMemo((): ListingMoqCartModel => {
    return {
      productId: product.id,
      mongoProductId: product.mongoProductId,
      categoryMongoId: product.categoryMongoId,
      productSlug: product.slug,
      productImage: product.image,
      productName: product.name,
      brand: product.brand || activeOffer.brand,
      category: product.category,
      sellerId: activeOffer.sellerId,
      sellerName: activeOffer.sellerName,
      size: selectedSize.size,
      pricePerUnit: selectedSize.withGST,
      basicPricePerUnit: selectedSize.basicPrice,
      qtyPerBag: selectedSize.qtyPerBag,
      pcsPerPacket: selectedSize.pcsPerPacket,
      moq: product.moq,
      moqBags: product.moqBags,
    };
  }, [product, activeOffer, selectedSize]);

  const moqMinPackets = useMemo(() => {
    const moqP = Math.max(0, Math.floor(Number(product.moq) || 0));
    const moqB = Math.max(0, Math.floor(Number(product.moqBags) || 0));
    const qpb = Math.max(0, Math.floor(Number(selectedSize.qtyPerBag) || 0));
    if (qpb > 0) return Math.max(moqP, moqB * qpb);
    return moqP;
  }, [product.moq, product.moqBags, selectedSize.qtyPerBag]);

  const moq = useMoqCartForModel(moqModel);
  const { bagQty, pktQty } = moq;

  return (
    <div className={styles.infoPanel}>
      {brandDisplay ? (
        <div className={styles.metaRow}>
          <span
            className={styles.sellerBrandPill}
            style={{ "--brand-color": brandPillColor } as React.CSSProperties}
          >
            {brandDisplay}
          </span>
        </div>
      ) : null}

      {/* Product Name */}
      <h1 className={styles.productName}>{productHeading(product.name, selectedSize.size)}</h1>

      {/* Product Code */}
      {product.brandCode && (
        <p className={styles.productCode}>
          Product Code: <strong>{product.brandCode}</strong>
        </p>
      )}

      {offers.length > 1 && (
        <div className={styles.sellerTabs}>
          <span className={styles.sellerTabsLabel}>Seller</span>
          <div className={styles.sellerTabRow} role="tablist" aria-label="Choose seller">
            {offers.map((o, i) => (
              <button
                key={o.sellerId}
                type="button"
                role="tab"
                aria-selected={i === sellerIdx}
                className={i === sellerIdx ? styles.sellerTabActive : styles.sellerTab}
                onClick={() => {
                  setSellerIdx(i);
                }}
              >
                {o.sellerName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Star Rating */}
      {/* <div className={styles.ratingRow}>
        <div className={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={star <= 4 ? "#f59e0b" : "none"}
              stroke="#f59e0b"
              strokeWidth="2"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ))}
        </div>
        <span className={styles.ratingText}>4.0 / 5 (Wholesale Rating)</span>
      </div> */}

      {/* Divider */}
      <div className={styles.divider} />

      {/* Price Card */}
      <div className={styles.priceCard}>
        <div className={styles.priceRow}>
          <div>
            <p className={styles.priceLabel}>Basic Price (ex-GST, per {labels.inner})</p>
            <p className={styles.basicPrice}>₹{selectedSize.basicPrice.toFixed(2)}</p>
          </div>
          <div className={styles.gstPriceBlock}>
            <p className={styles.priceLabel}>With GST (per {labels.inner})</p>
            <p className={styles.gstPrice}>₹{selectedSize.withGST.toFixed(2)}</p>
          </div>
        </div>
        <div className={styles.gstNote}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          GST included in final price
        </div>
        {pricesEffectiveDate && (
          <div className={styles.gstNote}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Prices effective {pricesEffectiveDate}
          </div>
        )}
      </div>

      {/* Bulk + inner order (2nd): Best value + quantity — labels from price list / DB */}
      <div className={styles.premiumBagSection}>
        <div className={styles.bagTopRow}>
          {hasBulk && <div className={styles.bagPromoTag}>Best value</div>}
          {(product.moq != null && product.moq > 0) ||
          (hasBulk && product.moqBags != null && product.moqBags > 0) ? (
            <p className={styles.bagMoqNote}>
              Minimum order:{" "}
              {product.moq != null && product.moq > 0 ? (
                <>
                  <strong>{product.moq}</strong> {labels.innerPlural}
                </>
              ) : null}
              {product.moq != null &&
              product.moq > 0 &&
              hasBulk &&
              product.moqBags != null &&
              product.moqBags > 0 ? (
                <> · </>
              ) : null}
              {hasBulk && product.moqBags != null && product.moqBags > 0 ? (
                <>
                  <strong>{product.moqBags}</strong> {labels.outerPlural}
                </>
              ) : null}
              {moqMinPackets > 0 &&
              hasBulk &&
              product.moqBags != null &&
              product.moqBags > 0 ? (
                <>
                  {" "}
                  (cart minimum: <strong>{moqMinPackets}</strong> {labels.innerPlural})
                </>
              ) : null}
            </p>
          ) : null}
          <p className={styles.bagCalc}>
            {hasBulk ? (
              (() => {
                const qtyPerBag = selectedSize.qtyPerBag;
                const pcs = selectedSize.pcsPerPacket;
                const totalPkts = pktQty;
                const totalBagsEq = bagQty;
                const totalPcs = totalPkts * pcs;
                if (pktQty === 0) {
                  return (
                    <>
                      Select {labels.outerPlural} or {labels.innerPlural} quantity
                    </>
                  );
                }
                const outerWordEq = totalBagsEq === 1 ? labels.outer : labels.outerPlural;
                return (
                  <>
                    {totalBagsEq} {outerWordEq} = {totalPkts} {labels.innerPlural} ({totalPcs.toLocaleString("en-IN")}{" "}
                    pcs)
                  </>
                );
              })()
            ) : (
              <>
                1 {labels.inner} = {selectedSize.pcsPerPacket} pcs · Price is per {labels.inner}
              </>
            )}
          </p>
        </div>

        <div id="pdp-add-to-cart" className={styles.bagActionControls}>
          <ListingMoqCartControlsView
            labels={labels}
            moq={moq}
            cardListingLayout
            className={listingMoqStyles.pdpCardListing}
          />
        </div>
      </div>

      {/* Packing details (3rd) */}
      <div className={styles.packingDashboard}>
        <div className={styles.packingHeader}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.29 7 12 12 20.71 7" />
            <line x1="12" y1="22" x2="12" y2="12" />
          </svg>
          <span className={styles.packingTitleMain}>PACKING DETAILS</span>
        </div>

        <div className={`${styles.packingGrid} ${!hasBulk ? styles.packingGridOne : ""}`}>
          <div className={`${styles.packingCard} ${styles.packItem}`}>
            <span className={styles.packValue}>{selectedSize.pcsPerPacket}</span>
            <span className={styles.packLabel}>Pcs/{labels.innerHeading}</span>
          </div>
          {hasBulk && (
            <div className={`${styles.packingCard} ${styles.bagItem}`}>
              <span className={styles.packValue}>{selectedSize.qtyPerBag}</span>
              <span className={styles.packLabel}>
                {labels.innerPlural} / {labels.outerHeading}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Key features — rich rows from admin or legacy string list */}
      {(() => {
        const keyLines = resolveKeyFeaturesForDisplay(product);
        if (keyLines.length === 0) return null;
        return (
          <div className={styles.featuresBlock}>
            <p className={styles.featuresTitle}>Key Features</p>
            <ul className={styles.featuresList}>
              {keyLines.map((line, i) => (
                <li key={i} className={styles.featureItem}>
                  <span className={styles.featureIconWrap}>
                    <KeyFeatureLineIcon icon={line.icon} />
                  </span>
                  <span className={styles.featureBody}>{renderKeyFeatureRichText(line.text)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Material */}
      {product.material && (
        <div className={styles.materialBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          Material: <strong>{product.material}</strong>
        </div>
      )}

    </div>
  );
}
