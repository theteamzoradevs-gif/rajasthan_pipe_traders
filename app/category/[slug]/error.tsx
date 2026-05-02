"use client";

import Link from "next/link";

export default function CategorySegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        maxWidth: 560,
        margin: "3rem auto",
        padding: "0 1.5rem",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>This category could not be loaded</h1>
      <p style={{ color: "#64748b", marginTop: "0.75rem", lineHeight: 1.6 }}>
        {error.message || "A server error occurred while loading this page."}
      </p>
      {error.digest ? (
        <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.5rem" }}>Ref: {error.digest}</p>
      ) : null}
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem" }}>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 8,
            background: "#1d4ed8",
            color: "#fff",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Home
        </Link>
      </div>
    </div>
  );
}
