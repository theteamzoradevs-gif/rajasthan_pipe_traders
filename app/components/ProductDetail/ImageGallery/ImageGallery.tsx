"use client";

import React, { useState } from "react";
import Image from "next/image";
import styles from "./ImageGallery.module.css";
import type { Product } from "../../../data/products";

interface ImageGalleryProps {
  product: Product;
}

export default function ImageGallery({ product }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const images = product.images.length > 0 ? product.images : [product.image];
  const activeImage = images[selectedIndex] ?? product.image;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  return (
    <div className={styles.gallery}>
      {/* Main Image */}
      <div
        className={`${styles.mainImageWrapper} ${isZoomed ? styles.zoomed : ""}`}
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
        style={
          isZoomed
            ? { "--zoom-x": `${mousePos.x}%`, "--zoom-y": `${mousePos.y}%` } as React.CSSProperties
            : {}
        }
      >
        {/* Badges */}
        <div className={styles.badgeGroup}>
          {product.isNew && <span className={styles.badgeNew}>New Arrival</span>}
          {product.isBestseller && (
            <span className={styles.badgeBestseller}>Bestseller</span>
          )}
        </div>

        {/* Zoom hint */}
        {!isZoomed && (
          <div className={styles.zoomHint}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
            </svg>
            Hover to zoom
          </div>
        )}

        <Image
          src={activeImage}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className={styles.mainImage}
          style={{ objectFit: "contain" }}
          priority
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className={styles.thumbnailStrip}>
          {images.map((img, i) => (
            <button
              key={i}
              className={`${styles.thumbnail} ${i === selectedIndex ? styles.active : ""}`}
              onClick={() => setSelectedIndex(i)}
              aria-label={`View image ${i + 1}`}
            >
              <Image
                src={img}
                alt={`${product.name} view ${i + 1}`}
                fill
                sizes="100px"
                style={{ objectFit: "contain" }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Trust badges */}
      <div className={styles.trustBadges}>
        {product.isIsiCertified && (
          <div className={styles.trustItem}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>ISI Certified</span>
          </div>
        )}
        <div className={styles.trustItem}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
            <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span>Bulk Orders</span>
        </div>
        <div className={styles.trustItem}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span>Pan India Delivery</span>
        </div>
      </div>
    </div>
  );
}
