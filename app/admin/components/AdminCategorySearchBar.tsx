"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminCategory } from "../types";

function flashRow(id: string) {
  const el = document.getElementById(`admin-row-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("admin-row-highlight");
  window.setTimeout(() => el.classList.remove("admin-row-highlight"), 2200);
}

type Props = {
  categories: AdminCategory[];
};

/** Admin-only: filter categories by name/slug and jump to the table row. */
export default function AdminCategorySearchBar({ categories }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return categories.filter(
      (c) => c.name.toLowerCase().includes(t) || c.slug.toLowerCase().includes(t),
    ).slice(0, 12);
  }, [categories, q]);

  const goTo = useCallback((id: string) => {
    flashRow(id);
    setOpen(false);
    setQ("");
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  return (
    <div className="admin-toolbar-search" ref={wrapRef}>
      <label className="admin-sr-only" htmlFor="admin-category-search">
        Search categories
      </label>
      <div className={`admin-search-block ${open && matches.length ? "is-open" : ""}`}>
        <svg className="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id="admin-category-search"
          type="search"
          className="admin-search-input"
          placeholder="Search categories…"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              goTo(matches[0]._id);
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
              setOpen(false);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {open && q.trim() && (
        <div className="admin-search-dropdown" role="listbox">
          {matches.length === 0 ? (
            <div className="admin-search-empty">No matching categories</div>
          ) : (
            matches.map((c) => (
              <button
                key={c._id}
                type="button"
                role="option"
                className="admin-search-option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goTo(c._id)}
              >
                <span className="admin-search-option-title">{c.name}</span>
                <span className="admin-search-option-meta">{c.slug}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
