import React from "react";
import Link from "next/link";
import styles from "./ProductDetail.module.css";
import ImageGallery from "./ImageGallery/ImageGallery";
import ProductInfo from "./ProductInfo/ProductInfo";
import SpecsTable from "./SpecsTable/SpecsTable";
import RelatedProducts from "./RelatedProducts/RelatedProducts";
import ComboTargetPdpNotice from "./ComboTargetPdpNotice";
import ComboTriggerPdpHint from "./ComboTriggerPdpHint";
import type { Product } from "../../data/products";
import type { ComboTargetAddBlockedInfo } from "@/lib/combo/comboAddGuard";

interface ProductDetailProps {
  product: Product;
  relatedProducts: Product[];
  /** Combo *target* PDP notice when `isEligibleForCombo` is true (storefront). */
  comboTargetPdpNotice?: ComboTargetAddBlockedInfo;
  /** Combo *trigger* PDP hint when this product helps unlock combo offers in cart. */
  comboTriggerPdpMessage?: string;
  comboTriggerTargetSlugs?: string[];
  comboTriggerTargetNames?: Record<string, string>;
}

export default function ProductDetail({
  product,
  relatedProducts,
  comboTargetPdpNotice,
  comboTriggerPdpMessage,
  comboTriggerTargetSlugs,
  comboTriggerTargetNames,
}: ProductDetailProps) {
  const aboutText = (product.longDescription || product.description || "").trim();

  return (
    <div className={styles.page}>
      {/* ── Breadcrumb ── */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <div className={styles.breadcrumbInner}>
          <Link href="/" className={styles.breadcrumbLink}>Home</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
          <Link href="/#shop" className={styles.breadcrumbLink}>Shop</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className={styles.breadcrumbCurrent}>{product.category}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className={styles.breadcrumbActive}>{product.name}</span>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <div className={styles.container}>
        {comboTriggerPdpMessage || comboTargetPdpNotice ? (
          <div className={styles.comboHeaderStack}>
            {comboTriggerPdpMessage ? (
              <ComboTriggerPdpHint
                productSlug={product.slug}
                message={comboTriggerPdpMessage}
                fallbackTargetSlugs={comboTriggerTargetSlugs}
                targetNameBySlug={comboTriggerTargetNames}
              />
            ) : null}
            {comboTargetPdpNotice ? (
              <ComboTargetPdpNotice productSlug={product.slug} info={comboTargetPdpNotice} />
            ) : null}
          </div>
        ) : null}

        {/* Top Section: Gallery + Info */}
        <div className={styles.topGrid}>
          <ImageGallery product={product} />
          <div className={styles.pdpInfoColumn}>
            <ProductInfo key={product.slug} product={product} />
          </div>
        </div>

        {/* Description — long text, or short description when long is empty (matches admin “Description” field) */}
        {aboutText ? (
          <div className={styles.descriptionBlock}>
            <h2 className={styles.descTitle}>About This Product</h2>
            <p className={styles.descText}>{aboutText}</p>
          </div>
        ) : null}

        {/* Specs Table (Tabs) */}
        <SpecsTable product={product} categoryProducts={relatedProducts} />



        {/* Related Products */}
        <RelatedProducts products={relatedProducts} />
      </div>
    </div>
  );
}
