"use client";

import React, { useEffect, useState } from "react";

interface Props {
  value: number;
  max: number;
  disabled?: boolean;
  onCommit: (order: number) => void;
}

export function EditableSortOrderCell({ value, max, disabled, onCommit }: Props) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function resetDraft() {
    setDraft(String(value));
  }

  function commit() {
    const parsed = Math.floor(Number(draft));
    if (!Number.isFinite(parsed) || parsed < 1) {
      resetDraft();
      return;
    }
    const clamped = Math.max(1, Math.min(max, parsed));
    setDraft(String(clamped));
    if (clamped !== value) {
      onCommit(clamped);
    }
  }

  return (
    <input
      type="number"
      className="admin-input"
      style={{ width: "4.5rem", minWidth: "4.5rem", padding: "0.25rem 0.4rem" }}
      min={1}
      max={max}
      step={1}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          resetDraft();
          (e.target as HTMLInputElement).blur();
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="Sort order"
    />
  );
}
