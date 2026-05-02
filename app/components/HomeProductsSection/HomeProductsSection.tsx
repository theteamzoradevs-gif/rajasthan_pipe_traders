"use client";

import React, { useEffect, useState } from "react";
import styles from "./HomeProductsSection.module.css";
import HomeProductsPagination from "./HomeProductsPagination";
import HomeProductsSortedGrid from "./HomeProductsSortedGrid";
import StorefrontPolicyFooterNote from "@/app/components/StorefrontPolicyFooterNote";
import { fetchProductsList } from "@/app/lib/api/client";
import type { ApiProduct } from "../../lib/api/types";

const PAGE_SIZE = 10;

type Props = {
  page?: number;
};

export default function HomeProductsSection({ page: pageProp = 1 }: Props) {
  const [page, setPage] = useState(Math.max(1, Math.floor(Number(pageProp)) || 1));
  const [pageProducts, setPageProducts] = useState<ApiProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setPage(Math.max(1, Math.floor(Number(pageProp)) || 1));
  }, [pageProp]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      try {
        const res = await fetchProductsList({
          productKind: "catalog",
          limit: PAGE_SIZE,
          skip: (page - 1) * PAGE_SIZE,
        });
        if (cancelled) return;

        const nextTotal = res.meta.total;
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
        const correctedPage = Math.min(page, nextTotalPages);

        if (correctedPage !== page) {
          setPage(correctedPage);
          return;
        }

        setPageProducts(res.data as ApiProduct[]);
        setTotal(nextTotal);
        setTotalPages(nextTotalPages);
      } catch {
        if (!cancelled) {
          setPageProducts([]);
          setTotal(0);
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headingRow}>
            <h2 className={styles.title}>All Products</h2>
          </div>
          <p className={styles.subtitle}>
            {isLoading
              ? "Loading products..."
              : "Browse our hardware and plumbing catalog"}
          </p>
        </div>

        <HomeProductsSortedGrid apiProducts={pageProducts} />

        <HomeProductsPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          isLoading={isLoading}
        />

        <div className={styles.footer}>
          <StorefrontPolicyFooterNote className={styles.footerNote} />
        </div>
      </div>
    </section>
  );
}
