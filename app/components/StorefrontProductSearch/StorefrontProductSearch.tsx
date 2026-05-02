"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchEntry } from "@/app/data/searchData";
import type { ApiProduct, ApiProductsListResponse } from "@/app/lib/api/types";

function apiProductToSearchEntry(p: ApiProduct): SearchEntry | null {
  const slug = typeof p.slug === "string" ? p.slug.trim() : "";
  if (!slug) return null;
  const category = p.category?.name?.trim() ?? "";
  const brand =
    (typeof p.brand === "string" && p.brand.trim()) ||
    (p.sellers?.[0] && typeof p.sellers[0].brand === "string" ? p.sellers[0].brand.trim() : "") ||
    "";
  return {
    name: typeof p.name === "string" ? p.name : "",
    slug,
    category,
    brand,
  };
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const qi = q.toLowerCase();
  const idx = lower.indexOf(qi);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="search-highlight">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

const SEARCH_DEBOUNCE_MS = 280;
/** Matches storefront GET /api/products max limit (see lib/catalog/storefront.ts). */
const SEARCH_LIMIT = 500;

export function useStorefrontProductSearch() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalMatchCount, setTotalMatchCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQuery.trim();

    if (q.length < 2) {
      if (abortRef.current) abortRef.current.abort();
      setSearchResults([]);
      setTotalMatchCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      void (async () => {
        try {
          const sp = new URLSearchParams({
            q,
            limit: String(SEARCH_LIMIT),
            skip: "0",
          });
          const res = await fetch(`/api/products?${sp.toString()}`, {
            signal: ac.signal,
            cache: "no-store",
            headers: { Accept: "application/json" },
          });
          const json = (await res.json()) as ApiProductsListResponse & { error?: string };
          if (ac.signal.aborted) return;
          if (!res.ok || !Array.isArray(json.data)) {
            setSearchResults([]);
            setTotalMatchCount(0);
            return;
          }
          const entries: SearchEntry[] = [];
          for (const p of json.data) {
            const e = apiProductToSearchEntry(p);
            if (e) entries.push(e);
          }
          setSearchResults(entries);
          setTotalMatchCount(typeof json.meta?.total === "number" ? json.meta.total : entries.length);
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          if (!ac.signal.aborted) {
            setSearchResults([]);
            setTotalMatchCount(0);
          }
        } finally {
          if (!ac.signal.aborted) setLoading(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchResults]);

  const navigateToProduct = useCallback(
    (result: SearchEntry) => {
      router.push(`/products/${encodeURIComponent(result.slug)}`);
      setSearchQuery("");
      setIsFocused(false);
    },
    [router],
  );

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    loading,
    totalMatchCount,
    navigateToProduct,
    isFocused,
    setIsFocused,
    activeIndex,
    setActiveIndex,
  };
}

export type StorefrontProductSearchState = ReturnType<typeof useStorefrontProductSearch>;

export function StorefrontProductSearchView({
  searchQuery,
  setSearchQuery,
  searchResults,
  loading,
  totalMatchCount,
  navigateToProduct,
  isFocused,
  setIsFocused,
  activeIndex,
  setActiveIndex,
}: StorefrontProductSearchState) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const qTrim = searchQuery.trim();
  const showDropdown = isFocused && qTrim.length > 0;
  const needMoreChars = qTrim.length === 1;

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [setIsFocused]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown && e.key !== "Escape") return;
    const len = searchResults.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (len === 0) return;
      setActiveIndex((i) => Math.min(i + 1, len - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (len === 0) return;
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (len > 0) {
        e.preventDefault();
        const r = searchResults[activeIndex] ?? searchResults[0];
        if (r) navigateToProduct(r);
      }
    } else if (e.key === "Escape") {
      setIsFocused(false);
    }
  };

  return (
    <div className="search-section" ref={wrapRef}>
      <div className={`search-bar ${isFocused ? "focused" : ""}`}>
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          className="search-input"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="storefront-search-results"
        />
        {searchQuery.trim() ? (
          <button
            type="button"
            className="search-clear-btn"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setSearchQuery("");
              setActiveIndex(0);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      {showDropdown ? (
        <div className="search-dropdown" id="storefront-search-results" role="listbox">
          {needMoreChars ? (
            <div className="search-no-results search-no-results--hint">
              <p>Type at least 2 characters</p>
              <span>Search matches name, SKU, brand, category, and more</span>
            </div>
          ) : loading ? (
            <div className="search-no-results search-no-results--loading">
              <p>Searching…</p>
            </div>
          ) : searchResults.length > 0 ? (
            <>
              <div className="search-dropdown-header">
                <span className="search-dropdown-header-label">Suggestions</span>
                <span className="search-dropdown-header-meta">
                  {totalMatchCount > searchResults.length
                    ? `${searchResults.length} of ${totalMatchCount}`
                    : `${searchResults.length} ${searchResults.length === 1 ? "result" : "results"}`}
                </span>
              </div>
              <ul className="search-results-list" role="presentation">
                {searchResults.map((result, i) => {
                  const initial = (result.name.trim().charAt(0) || "?").toUpperCase();
                  return (
                    <li key={result.slug} role="option" aria-selected={i === activeIndex}>
                      <button
                        type="button"
                        className={`search-suggestion-card ${i === activeIndex ? "is-active" : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => navigateToProduct(result)}
                      >
                        <span className="search-suggestion-avatar" aria-hidden>
                          {initial}
                        </span>
                        <div className="search-suggestion-body">
                          <span className="search-suggestion-name">{highlightMatch(result.name, searchQuery)}</span>
                          <div className="search-suggestion-tags">
                            {result.category ? (
                              <span className="search-suggestion-pill search-suggestion-pill--muted">{result.category}</span>
                            ) : null}
                            {result.brand ? (
                              <span className="search-suggestion-pill">{result.brand}</span>
                            ) : null}
                          </div>
                        </div>
                        <span className="search-suggestion-chevron" aria-hidden>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="m10 17 5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="search-no-results">
              <p>No products found</p>
              <span>Try a different name, SKU, or brand</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
