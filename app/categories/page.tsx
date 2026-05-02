"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import pageStyles from "./page.module.css";
import { fetchCategoriesList, fetchProductsList } from "../lib/api/client";
import type { ApiCategory, ApiProduct } from "../lib/api/types";

const CATEGORY_BG_COLORS = ["#ffccd5", "#b3e5fc", "#c8e6c9", "#e1bee7", "#ffe0b2", "#d7ccc8"];
const CATEGORY_CARD_IMAGES = ["/Cable_Clip.png", "/Nail_Cable_Clip.png"];

function countCatalogByCategorySlug(products: ApiProduct[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of products) {
    const slug = p.category?.slug;
    if (!slug) continue;
    map.set(slug, (map.get(slug) ?? 0) + 1);
  }
  return map;
}

export default function AllCategoriesPage() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [countsBySlug, setCountsBySlug] = useState<Map<string, number>>(new Map());
  const [loadState, setLoadState] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: cats }, { data: prods }] = await Promise.all([
          fetchCategoriesList(),
          fetchProductsList({ productKind: "catalog", limit: 500, skip: 0 }),
        ]);
        if (cancelled) return;
        setCategories(cats);
        setCountsBySlug(countCatalogByCategorySlug(prods));
        setLoadState("ok");
      } catch {
        if (cancelled) return;
        setCategories([]);
        setCountsBySlug(new Map());
        setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={pageStyles.page}>
      <nav className={pageStyles.breadcrumb} aria-label="Breadcrumb">
        <div className={pageStyles.breadcrumbInner}>
          <Link href="/">Home</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className={pageStyles.breadcrumbCurrent}>All categories</span>
        </div>
      </nav>

      <div className={pageStyles.inner}>
        <h1 className={pageStyles.pageTitle}>All categories</h1>
        <p className={pageStyles.pageSubtitle}>Browse our complete range of product categories</p>
        {loadState === "loading" && <p className={pageStyles.pageSubtitle}>Loading…</p>}
        {loadState === "error" && <p className={pageStyles.errorText}>Could not load categories. Please try again later.</p>}

        <div className={pageStyles.allGrid}>
          {categories.map((cat, i) => {
            const count = countsBySlug.get(cat.slug) ?? 0;
            const bgColor = CATEGORY_BG_COLORS[i % CATEGORY_BG_COLORS.length];
            const imageSrc = CATEGORY_CARD_IMAGES[i % CATEGORY_CARD_IMAGES.length];
            return (
              <Link key={cat._id} href={`/category/${cat.slug}`} className={pageStyles.card}>
                <div className={pageStyles.imageArea} style={{ background: bgColor }}>
                  <div className={pageStyles.imageWrap}>
                    <Image
                      src={imageSrc}
                      alt={cat.name}
                      fill
                      sizes="(max-width: 640px) 45vw, (max-width: 1280px) 20vw, 200px"
                      style={{ objectFit: "contain", padding: "0.8rem" }}
                    />
                  </div>
                </div>
                <div className={pageStyles.info}>
                  <div className={pageStyles.text}>
                  <div className={pageStyles.metaRow}>

                    <h2 className={pageStyles.name}>{cat.name}</h2>
                      <p className={pageStyles.count}>{count} items</p>
           
                    </div>
                    <div className={pageStyles.arrowBtn} aria-hidden="true">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
