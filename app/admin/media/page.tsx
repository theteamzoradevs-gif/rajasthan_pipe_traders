"use client";

import { useCallback, useEffect, useState } from "react";

type MediaRow = Record<string, unknown>;

function normalizeMediaList(json: unknown): MediaRow[] {
  if (!json || typeof json !== "object") return [];
  const d = (json as Record<string, unknown>).data;
  if (Array.isArray(d)) return d as MediaRow[];
  if (d && typeof d === "object") {
    const o = d as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as MediaRow[];
    if (Array.isArray(o.docs)) return o.docs as MediaRow[];
    if (Array.isArray(o.results)) return o.results as MediaRow[];
  }
  return [];
}

function metaNextCursor(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const m = (json as Record<string, unknown>).meta;
  if (!m || typeof m !== "object") return undefined;
  const c = (m as Record<string, unknown>).nextCursor;
  return typeof c === "string" && c.length > 0 ? c : undefined;
}

function rowUrl(row: MediaRow): string {
  const v =
    row.secure_url ??
    row.secureUrl ??
    row.url ??
    row.cloudinaryUrl ??
    row.src ??
    (row.file && typeof row.file === "object"
      ? (row.file as Record<string, unknown>).secure_url
      : undefined);
  return typeof v === "string" ? v : "";
}

function rowId(row: MediaRow): string {
  const v = row.public_id ?? row._id ?? row.id;
  return typeof v === "string" ? v : "";
}

export default function AdminMediaPage() {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Cursor sent to Cloudinary for the current page (undefined = first page). */
  const [activeCursor, setActiveCursor] = useState<string | undefined>(undefined);
  /** Stack of prior cursors for “Previous page”. */
  const [cursorBackStack, setCursorBackStack] = useState<(string | undefined)[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const limit = 20;

  const loadWith = useCallback(async (cursor: string | undefined) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ limit: String(limit) });
      if (cursor) q.set("cursor", cursor);
      const res = await fetch(`/api/admin/media?${q}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          json && typeof json === "object" && "message" in json
            ? String((json as { message: unknown }).message)
            : res.statusText;
        throw new Error(msg);
      }
      setItems(normalizeMediaList(json));
      setNextCursor(metaNextCursor(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load media");
      setItems([]);
      setNextCursor(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWith(activeCursor);
  }, [activeCursor, loadWith]);

  function goNextPage() {
    if (!nextCursor) return;
    setCursorBackStack((s) => [...s, activeCursor]);
    setActiveCursor(nextCursor);
  }

  function goPrevPage() {
    setCursorBackStack((s) => {
      if (s.length === 0) return s;
      const prev = s[s.length - 1];
      setActiveCursor(prev);
      return s.slice(0, -1);
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this image from Cloudinary?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/media/${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          json && typeof json === "object" && "message" in json
            ? String((json as { message: unknown }).message)
            : res.statusText;
        throw new Error(msg);
      }
      await loadWith(activeCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const canGoBack = cursorBackStack.length > 0;

  return (
    <div>
      <p className="muted" style={{ marginBottom: "1rem", maxWidth: "42rem" }}>
        All uploaded images are saved in your Cloudinary account. By default, they are grouped inside the{" "}
        <code style={{ fontSize: "0.8rem" }}>rpt/</code> folder.
      </p>
      {error ? (
        <div className="admin-banner err" role="alert">
          {error}
        </div>
      ) : null}
      <div className="admin-toolbar">
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          onClick={() => {
            setCursorBackStack([]);
            setActiveCursor(undefined);
            void loadWith(undefined);
          }}
          disabled={loading}
        >
          First page
        </button>
        <button type="button" className="admin-btn admin-btn-ghost" onClick={() => void loadWith(activeCursor)} disabled={loading}>
          Refresh
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          disabled={loading || !canGoBack}
          onClick={() => goPrevPage()}
        >
          Previous page
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          disabled={loading || !nextCursor}
          onClick={() => goNextPage()}
        >
          Next page
        </button>
        <span className="muted" style={{ fontSize: "0.875rem" }}>
          {items.length} image(s) on this page
        </span>
      </div>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--nowrap">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Public id</th>
                <th>Meta</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const id = rowId(row);
                const url = rowUrl(row);
                return (
                  <tr key={id || JSON.stringify(row)}>
                    <td>{url ? <img src={url} alt="" className="admin-thumb" /> : "—"}</td>
                    <td>
                      <code style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>{id || "—"}</code>
                    </td>
                    <td>
                      <span className="muted" style={{ fontSize: "0.8rem" }}>
                        {row.format != null ? String(row.format) : "—"}
                        {row.bytes != null ? ` · ${String(row.bytes)} B` : ""}
                      </span>
                    </td>
                    <td>
                      {id ? (
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger"
                          onClick={() => void handleDelete(id)}
                        >
                          Delete
                        </button>
                      ) : null}
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-btn admin-btn-ghost"
                          style={{ marginLeft: 8, display: "inline-flex" }}
                        >
                          Open
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 ? <p className="muted" style={{ padding: "1rem" }}>No images under this prefix (or empty page).</p> : null}
        </div>
      )}
    </div>
  );
}
