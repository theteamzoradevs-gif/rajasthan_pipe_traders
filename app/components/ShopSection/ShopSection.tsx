"use client";

import React, { useState, useMemo } from 'react';
import CategoryRow from './CategoryRow/CategoryRow';
import ProductGrid from './ProductGrid/ProductGrid';
import StorefrontPolicyFooterNote from '@/app/components/StorefrontPolicyFooterNote';
import { expandProductsForListing, products } from '../../data/products';
import styles from './ShopSection.module.css';

const SHOP_CATEGORIES = [
  { id: 'All', label: 'All', image: '/Cable_Clip.png', color: '#f1f5f9', textColor: '#475569' },
  { id: 'Cable Clips', label: 'Cable Clips', image: '/Cable_Clip.png', color: '#dbeafe', textColor: '#1d4ed8' },
  { id: 'Fasteners & Hardware', label: 'Fasteners & Hardware', image: '/Nail_Cable_Clip.png', color: '#fef3c7', textColor: '#92400e' },
  { id: 'Electrical Accessories', label: 'Electrical Accessories', image: '/Cable_Clip.png', color: '#dcfce7', textColor: '#166534' },
  { id: 'Boxes & Plates', label: 'Boxes & Plates', image: '/Cable_Clip.png', color: '#ede9fe', textColor: '#6d28d9' },
  { id: 'Sanitaryware', label: 'Sanitaryware', image: '/Cable_Clip.png', color: '#ccfbf1', textColor: '#0f766e' },
];

export default function ShopSection() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredProducts = useMemo(
    () => activeCategory === 'All' ? products : products.filter(p => p.category === activeCategory),
    [activeCategory]
  );

  const filteredListing = useMemo(
    () => expandProductsForListing(filteredProducts),
    [filteredProducts]
  );

  const activeCat = SHOP_CATEGORIES.find(c => c.id === activeCategory);

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <CategoryRow
          categories={SHOP_CATEGORIES}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
          products={products}
        />

        <div className={styles.divider} />

        <div className={styles.productsHeader}>
          <div className={styles.headingRow}>
            <h2 className={styles.heading}>
              {activeCategory === 'All' ? 'All Products' : activeCategory}
            </h2>
            <span
              className={styles.countPill}
              style={activeCat ? { background: activeCat.color, color: activeCat.textColor } : {}}
            >
              {filteredListing.length} {filteredListing.length === 1 ? 'listing' : 'listings'}
            </span>
          </div>
          <p className={styles.subtext}>
            {activeCategory === 'All'
              ? 'Browse our complete range of quality hardware & plumbing products'
              : `Showing all ${activeCategory.toLowerCase()} products`}
          </p>
        </div>

        <ProductGrid listingEntries={filteredListing} />

        <div className={styles.footer}>
          <StorefrontPolicyFooterNote className={styles.footerNote} />
        </div>
      </div>
    </section>
  );
}
