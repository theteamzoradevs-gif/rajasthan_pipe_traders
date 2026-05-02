"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type Suggestion = { _id: string; name: string; sku?: string; slug?: string };

type Props = {
  /** Run search from toolbar: loads page 0 with optional scroll to a row. */
  onRunSearch: (query: string, scrollToId?: string) => void;
};

/** Admin-only: search products by name/SKU/slug via API and jump to the table row. */
export default function AdminProductSearchBar({ onRunSearch }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (term: string) => {
    const t = term.trim();
    if (!t) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const sp = new URLSearchParams({ limit: "12", skip: "0", q: t });
      const res = await fetch(`/api/admin/products?${sp}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setSuggestions([]);
        return;
      }
      const rows = json.data as Suggestion[];
      setSuggestions(Array.isArray(rows) ? rows : []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = q;
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(term);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, fetchSuggestions]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function pick(id: string, queryForTable: string) {
    onRunSearch(queryForTable.trim(), id);
    setOpen(false);
  }

  function submitSearch() {
    const term = q.trim();
    onRunSearch(term);
    setOpen(false);
  }

  return (
    <div className="admin-toolbar-search" ref={wrapRef}>
      <label className="admin-sr-only" htmlFor="admin-product-search">
        Search products
      </label>
      <div className={`admin-search-block ${open && q.trim() ? "is-open" : ""}`}>
        <svg className="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id="admin-product-search"
          type="search"
          className="admin-search-input"
          placeholder="Search name, SKU, slug…"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (suggestions[0] && q.trim()) pick(suggestions[0]._id, q);
              else submitSearch();
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {q.trim() ? (
          <button
            type="button"
            className="admin-search-clear"
            aria-label="Clear"
            onClick={() => {
              setQ("");
              setSuggestions([]);
              onRunSearch("");
              setOpen(false);
            }}
          >
            ×
          </button>
        ) : null}
        <button type="button" className="admin-search-go" onClick={() => submitSearch()}>
          Go
        </button>
      </div>
      {open && q.trim() ? (
        <div className="admin-search-dropdown" role="listbox">
          {loading ? (
            <div className="admin-search-empty">Searching…</div>
          ) : suggestions.length === 0 ? (
            <div className="admin-search-empty">No matching products</div>
          ) : (
            suggestions.map((p) => (
              <button
                key={p._id}
                type="button"
                role="option"
                className="admin-search-option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p._id, q)}
              >
                <span className="admin-search-option-title">{p.name}</span>
                <span className="admin-search-option-meta">
                  {[p.sku, p.slug].filter(Boolean).join(" · ") || "—"}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
