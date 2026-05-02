"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./HomeCategoryGrid.module.css";
import { fetchCategoriesList, fetchProductsList } from "../../lib/api/client";
import type { ApiCategory, ApiProduct } from "../../lib/api/types";

const CATEGORY_BG_COLORS = ["#ffccd5", "#b3e5fc", "#c8e6c9", "#e1bee7", "#ffe0b2", "#d7ccc8"];
const CATEGORY_CARD_IMAGES = ["/Cable_Clip.png", "/Nail_Cable_Clip.png"];

/** Must match `.track` gap (1.25rem) and min column width (220px) in HomeCategoryGrid.module.css */
const GRID_GAP_PX = 20;
const GRID_MIN_TRACK_PX = 220;
const MOBILE_MAX_WIDTH = 768;
const AUTOPLAY_INTERVAL_MS = 2500;

function maxCategoriesForTwoRows(gridWidthPx: number, isMobileView: boolean): number {
  if (isMobileView) {
    return 1;
  }
  const cols = Math.max(1, Math.floor((gridWidthPx + GRID_GAP_PX) / (GRID_MIN_TRACK_PX + GRID_GAP_PX)));
  return cols * 2;
}

function countCatalogByCategorySlug(products: ApiProduct[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of products) {
    const slug = p.category?.slug;
    if (!slug) continue;
    map.set(slug, (map.get(slug) ?? 0) + 1);
  }
  return map;
}

function truncateToWords(input: string, maxWords: number): { text: string; truncated: boolean } {
  const words = String(input ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return { text: input, truncated: false };
  return { text: `${words.slice(0, maxWords).join(" ")}...`, truncated: true };
}

export default function HomeCategoryGrid() {
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [countsBySlug, setCountsBySlug] = useState<Map<string, number>>(new Map());
  const [loadState, setLoadState] = useState<"loading" | "error" | "ok">("loading");
  const [maxHomeCategories, setMaxHomeCategories] = useState(12);
  const [page, setPage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const recomputeHomeLimit = useCallback(() => {
    const el = gridWrapRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const isMobileView = typeof window !== "undefined" && window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
    setMaxHomeCategories(maxCategoriesForTwoRows(w, isMobileView));
  }, []);

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

  /* Recompute when category count changes (e.g. after fetch). Fixed deps array length. */
  useLayoutEffect(() => {
    recomputeHomeLimit();
  }, [recomputeHomeLimit, categories.length]);

  /* Observers once; do not include variable-length or hot-reload-affected dep lists. */
  useEffect(() => {
    const el = gridWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      recomputeHomeLimit();
    });
    ro.observe(el);
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const onMql = () => recomputeHomeLimit();
    mql.addEventListener("change", onMql);
    return () => {
      ro.disconnect();
      mql.removeEventListener("change", onMql);
    };
  }, [recomputeHomeLimit]);

  const pageSize = Math.max(1, maxHomeCategories);
  const totalPages = Math.max(1, Math.ceil(categories.length / pageSize));
  const categoryPages = useMemo(() => {
    const pages: ApiCategory[][] = [];
    for (let i = 0; i < categories.length; i += pageSize) {
      pages.push(categories.slice(i, i + pageSize));
    }
    return pages.length > 0 ? pages : [[]];
  }, [categories, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const goPrev = useCallback(() => {
    if (totalPages <= 1) return;
    setPage((p) => (p - 1 + totalPages) % totalPages);
  }, [totalPages]);

  const goNext = useCallback(() => {
    if (totalPages <= 1) return;
    setPage((p) => (p + 1) % totalPages);
  }, [totalPages]);

  useEffect(() => {
    if (totalPages <= 1) return;
    if (isPaused) return;
    const timer = window.setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, totalPages]);

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <div className={styles.header}>
            <h2 className={styles.title}>Shop by Category</h2>
            <p className={styles.subtitle}>Browse our complete range of quality products</p>
            {loadState === "loading" && (
              <p className={styles.subtitle} style={{ marginTop: "0.35rem", opacity: 0.8 }}>
                Loading categories…
              </p>
            )}
            {loadState === "error" && (
              <p className={styles.subtitle} style={{ marginTop: "0.35rem", color: "#b91c1c" }}>
                Could not load categories. Please try again later.
              </p>
            )}
          </div>
        </div>

        <div
          className={styles.gridWrap}
          ref={gridWrapRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            className={styles.pagesTrack}
            style={{ transform: `translate3d(${-page * 100}%, 0, 0)` }}
          >
            {categoryPages.map((pageCategories, pageIndex) => (
              <div className={styles.pageSlide} key={`cat-page-${pageIndex}`}>
                <div className={styles.track}>
                  {pageCategories.map((cat, i) => {
                    const count = countsBySlug.get(cat.slug) ?? 0;
                    const idx = pageIndex * pageSize + i;
                    const bgColor = CATEGORY_BG_COLORS[idx % CATEGORY_BG_COLORS.length];
                    const imageSrc = CATEGORY_CARD_IMAGES[idx % CATEGORY_CARD_IMAGES.length];
                    const displayName = truncateToWords(cat.name, 4);
                    return (
                      <Link
                        key={cat._id}
                        href={`/category/${cat.slug}`}
                        className={styles.card}
                      >
                        <div className={styles.imageArea} style={{ background: bgColor }}>
                          <div className={styles.imageWrap}>
                            <Image
                              src={imageSrc}
                              alt={cat.name}
                              fill
                              sizes="(max-width: 640px) 60vw, (max-width: 1280px) 28vw, 20vw"
                              priority={idx < 4}
                              style={{ objectFit: "contain", padding: "0.8rem" }}
                            />
                          </div>
                        </div>
                        <div className={styles.info}>
                          <div className={styles.text}>
                            <h3 className={styles.name}>
                              <span className={styles.nameTooltipWrap}>
                                {displayName.text}
                                <span className={styles.nameTooltip}>{cat.name}</span>
                              </span>
                            </h3>
                            <div className={styles.metaRow}>
                            <p className={styles.count}>{count} items</p>
                            <div className={styles.arrowBtn} aria-hidden="true">
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

                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.9rem" }}>
          {totalPages > 1 ? (
            <>
              <button
                type="button"
                className={styles.viewAllLink}
                onClick={goPrev}
                aria-label="Previous category slide"
              >
                ‹
              </button>
              <span className={styles.subtitle} style={{ minWidth: "3.25rem", textAlign: "center" }}>
                {page + 1}/{totalPages}
              </span>
              <button
                type="button"
                className={styles.viewAllLink}
                onClick={goNext}
                aria-label="Next category slide"
              >
                ›
              </button>
            </>
          ) : null}
          <Link href="/categories" className={styles.viewAllLink}>
            View all
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
