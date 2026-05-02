"use client";

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import './Products.css';
import {
  expandProductsForListing,
  products,
  type ProductListingEntry,
} from '../../data/products';
import { productHeading, brandPillLabel, resolveBrandPillVariant } from '../../lib/productHeading';
import { resolvePackingUnitLabels } from '@/lib/packingLabels';
import ListingMoqCartControls, { listingEntryToModel } from '@/app/components/ListingMoqCartControls/ListingMoqCartControls';
import StorefrontPolicyFooterNote from '@/app/components/StorefrontPolicyFooterNote';

const CATEGORIES = ['All', 'Cable Clips', 'Fasteners & Hardware', 'Electrical Accessories', 'Boxes & Plates', 'Sanitaryware'];

function listingKey(productId: number, sellerId: string) {
  return `${productId}:${sellerId}`;
}

export default function Products() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredEntries = useMemo(() => {
    const base =
      activeCategory === 'All'
        ? products
        : products.filter((p) => p.category === activeCategory);
    return expandProductsForListing(base);
  }, [activeCategory]);

  return (
    <section className="products-section">
      <div className="products-container">

        

        {/* Category Filter Tabs */}
        <div className="filter-tabs-wrapper">
          <div className="filter-tabs">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`filter-tab ${activeCategory === cat ? 'filter-tab-active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
                {cat !== 'All' && (
                  <span className="filter-count">
                    {products.filter(p => p.category === cat).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="products-grid">
          {filteredEntries.map((entry) => {
            const { product, offer } = entry;
            const brandSource = (product.brand || offer.brand || "").trim();
            const pillLabel = brandPillLabel(brandSource);
            const variant = resolveBrandPillVariant(brandSource);
            const pillClass =
              variant === "hitech"
                ? "listing-brand-pill-hitech"
                : variant === "tejas"
                  ? "listing-brand-pill-tejas"
                  : variant === "nstar"
                    ? "listing-brand-pill-nstar"
                    : "listing-brand-pill-default";
            const size0 = offer.sizes[0];
            const lowestPrice = size0.withGST;
            const lowestBasic = size0.basicPrice;
            const listLabels = resolvePackingUnitLabels(product, size0);
            const lk = listingKey(product.id, offer.sellerId);

            return (
              <Link
                key={lk}
                href={`/products/${product.slug}`}
                className="product-card"
              >
                {/* Image Container */}
                <div className="product-image-wrapper">
                  {/* Badges */}
                  <div className="badge-group">
                    {product.isNew && <span className="badge-new">New</span>}
                    {product.isBestseller && <span className="badge-hot">Hot</span>}
                  </div>

                  {/* Product Image */}
                  <div className="image-inner">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      style={{ objectFit: 'contain', padding: '1.5rem' }}
                    />
                  </div>

                 
                </div>

                {/* Card Content */}
                <div className="product-info">
                  {pillLabel ? (
                    <div className="info-meta">
                      <span className={`listing-brand-pill ${pillClass}`}>{pillLabel}</span>
                    </div>
                  ) : null}

                  {/* Name */}
                  <h3 className="product-title">{productHeading(product.name, size0.size)}</h3>

                  {/* Description */}
                  <p className="product-description">{product.description}</p>

                  {/* Pricing */}
                  <div className="product-pricing">
                    <div className="pricing-left">
                      <span className="price-from">from</span>
                      <span className="sale-price">₹{lowestPrice.toFixed(2)}</span>
                      <span className="gst-tag">incl. GST / {listLabels.inner}</span>
                    </div>
                    <span className="original-price">₹{lowestBasic.toFixed(2)}</span>
                  </div>

                  {/* <ListingMoqCartControls
                    model={listingEntryToModel(entry)}
                    labels={listLabels}
                    className="listing-moq-wrap"
                  /> */}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer row */}
        <div className="products-footer">
          <StorefrontPolicyFooterNote className="footer-note" />
          <Link href="/#shop" className="view-catalogue-btn">
            View Full Catalogue
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

      </div>

    </section>
  );
}
