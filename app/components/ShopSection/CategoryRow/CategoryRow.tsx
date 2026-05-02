"use client";

import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './CategoryRow.module.css';
import { Product } from '../../../data/products';

interface Category {
  id: string;
  label: string;
  image: string;
  color: string;
  textColor: string;
}

interface CategoryRowProps {
  categories: Category[];
  activeCategory: string;
  onSelect: (id: string) => void;
  products: Product[];
}

export default function CategoryRow({ categories, activeCategory, onSelect, products }: CategoryRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateScrollState); ro.disconnect(); };
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    trackRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  const getCount = (id: string) =>
    id === 'All' ? products.length : products.filter(p => p.category === id).length;

  return (
    <div className={styles.outerWrapper}>
      <button
        className={`${styles.scrollArrow} ${styles.scrollArrowLeft} ${!canScrollLeft ? styles.scrollArrowDisabled : ''}`}
        onClick={() => scroll('left')}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
      </button>

      <div className={styles.wrapper} ref={trackRef}>
        <div className={styles.track}>
          {categories.map((cat, idx) => {
            const isActive = activeCategory === cat.id;
            const count = getCount(cat.id);
            return (
              <button
                key={cat.id}
                className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                onClick={() => onSelect(cat.id)}
                aria-pressed={isActive}
              >
                <div
                  className={styles.iconBox}
                  style={{
                    background: isActive ? cat.color : '#f8fafc',
                    borderColor: isActive ? cat.textColor + '44' : '#e2e8f0',
                  }}
                >
                  <Image
                    src={cat.image}
                    alt={cat.label}
                    width={58}
                    height={58}
                    sizes="58px"
                    priority={idx < 4}
                    style={{ objectFit: 'contain' }}
                  />
                </div>
                <span
                  className={styles.label}
                  style={{ color: isActive ? cat.textColor : '#475569', fontWeight: isActive ? 700 : 600 }}
                >
                  {cat.label}
                </span>
                <span
                  className={styles.badge}
                  style={isActive ? { background: cat.color, color: cat.textColor } : {}}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        className={`${styles.scrollArrow} ${styles.scrollArrowRight} ${!canScrollRight ? styles.scrollArrowDisabled : ''}`}
        onClick={() => scroll('right')}
        disabled={!canScrollRight}
        aria-label="Scroll right"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  );
}
