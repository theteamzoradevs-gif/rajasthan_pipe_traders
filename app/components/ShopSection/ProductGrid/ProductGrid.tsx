"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './ProductGrid.module.css';
import type { ProductListingEntry } from '../../../data/products';
import { productHeading, brandPillLabel, resolveBrandPillVariant } from '../../../lib/productHeading';
import { resolvePackingUnitLabels } from '@/lib/packingLabels';
import ListingMoqCartControls, { listingEntryToModel } from '@/app/components/ListingMoqCartControls/ListingMoqCartControls';
import listingMoqStyles from '@/app/components/ListingMoqCartControls/ListingMoqCartControls.module.css';

interface ProductGridProps {
  /** One row per product × seller (already filtered/sorted when applicable). */
  listingEntries: ProductListingEntry[];
  /** Home “All Products”: label left, quantity box right. */
  cardListingLayout?: boolean;
  /**
   * Category pages: stacked price labels + full-width MOQ rows with captions (matches cart-style hierarchy).
   * Implies `cardListingLayout` for quantity controls.
   */
  categoryCardLayout?: boolean;
  /** `four`: category-style grid — 4 cards per row on large screens (default is 5). */
  gridDensity?: "default" | "four";
  /** Optional: show "COMBO OFFER" for slugs that qualify as trigger products. */
  comboTriggerSlugs?: string[];
  /** When false, keep only product name (no size suffix in title). */
  showSizeInTitle?: boolean;
}

function listingKey(productId: number, sellerId: string) {
  return `${productId}:${sellerId}`;
}

export default function ProductGrid({
  listingEntries: entries,
  cardListingLayout = false,
  categoryCardLayout = false,
  gridDensity = "default",
  comboTriggerSlugs = [],
  showSizeInTitle = true,
}: ProductGridProps) {
  const useCardListing = cardListingLayout || categoryCardLayout;
  const triggerSlugSet = useMemo(
    () => new Set(comboTriggerSlugs.map((s) => s.trim().toLowerCase()).filter(Boolean)),
    [comboTriggerSlugs]
  );
  const imageSizes =
    gridDensity === "four"
      ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1279px) 25vw, 25vw"
      : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1279px) 25vw, 20vw";
  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <p>No products found in this category.</p>
      </div>
    );
  }


  const priorityUpTo = 6;

  return (
    <div className={`${styles.grid} ${gridDensity === "four" ? styles.gridDensityFour : ""}`}>
      {entries.map((entry, index) => {
        const { product, offer } = entry;
        const normalizedSlug = String(product.slug || "").trim().toLowerCase();
        const showComboOfferBadge = normalizedSlug.length > 0 && triggerSlugSet.has(normalizedSlug);
        const brandSource = (product.brand || offer.brand || "").trim();
        const pillLabel = brandPillLabel(brandSource);
        const variant = resolveBrandPillVariant(brandSource);
        const pillClass =
          variant === "hitech"
            ? styles.listingBrandHitech
            : variant === "tejas"
              ? styles.listingBrandTejas
              : variant === "nstar"
                ? styles.listingBrandNstar
                : styles.listingBrandDefault;
        const size0 = offer.sizes[0];
        const listLabels = resolvePackingUnitLabels(product, size0);
        const lk = listingKey(product.id, offer.sellerId);

        return (
          <Link key={lk} href={`/products/${product.slug}`} className={styles.card}>
            {/* Image area */}
            <div className={styles.imageWrapper}>
              <div className={styles.imageInner}>
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes={imageSizes}
                  priority={index < priorityUpTo}
                  style={{ objectFit: 'contain', padding: '0.8rem' }}
                />
              </div>
            </div>

            {/* Card info */}
            <div className={styles.info}>
              {pillLabel || showComboOfferBadge ? (
                <div className={styles.meta}>
                  {pillLabel ? (
                    <span className={`${styles.listingBrand} ${pillClass}`}>{pillLabel}</span>
                  ) : null}
                  {showComboOfferBadge ? (
                    <span className={styles.listingComboOffer}>Combo Offer</span>
                  ) : null}
                </div>
              ) : null}

              <h3 className={styles.title}>
                {showSizeInTitle ? productHeading(product.name, size0.size) : product.name}
              </h3>
              {categoryCardLayout ? (
                <div className={styles.cardPriceStack}>
                  <span className={styles.cardPriceLabel}>Price (incl. GST)</span>
                  <p className={styles.cardPriceGst}>
                    ₹{size0.withGST.toFixed(2)} / {listLabels.inner}
                  </p>
                  <span className={styles.cardPriceLabel}>Basic</span>
                  <p className={styles.cardPriceBasic}>₹{size0.basicPrice.toFixed(2)}</p>
                </div>
              ) : (
                <div className={styles.cardPriceBlock}>
                  <p className={styles.cardPriceGst}>
                    ₹{size0.withGST.toFixed(2)} incl. GST / {listLabels.inner}
                  </p>
                  <p className={styles.cardPriceBasic}>₹{size0.basicPrice.toFixed(2)} basic</p>
                </div>
              )}
              <ListingMoqCartControls
                model={listingEntryToModel(entry)}
                labels={listLabels}
                className={`${styles.listingMoqWrap} ${categoryCardLayout ? listingMoqStyles.categoryCardListing : ""}`}
                cardListingLayout={useCardListing}
                labeledBulkCardRows={categoryCardLayout}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
