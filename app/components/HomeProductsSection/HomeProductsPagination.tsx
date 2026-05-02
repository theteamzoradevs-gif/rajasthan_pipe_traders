"use client";

import styles from "./HomeProductsSection.module.css";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  isLoading?: boolean;
};

export default function HomeProductsPagination({ page, totalPages, onPageChange, isLoading = false }: Props) {
  if (totalPages <= 1) return null;

  const canPrev = page > 1 && !isLoading;
  const canNext = page < totalPages && !isLoading;

  return (
    <nav className={styles.pagination} aria-label="Product list pagination">
      {canPrev ? (
        <button type="button" className={styles.paginationLink} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
      ) : (
        <span className={styles.paginationDisabled}>Previous</span>
      )}
      <span className={styles.paginationStatus}>
        Page {page} of {totalPages}
      </span>
      {canNext ? (
        <button type="button" className={styles.paginationLink} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      ) : (
        <span className={styles.paginationDisabled}>Next</span>
      )}
    </nav>
  );
}
