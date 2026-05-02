"use client";

import { useEffect, useId, useRef, useState } from "react";
import { extractUploadResult } from "@/lib/media-upload-result";

function errorMessage(res: Response, json: unknown): string {
  if (json && typeof json === "object" && "message" in json) {
    const m = (json as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return res.statusText || "Request failed";
}

export type MediaImageFieldProps = {
  label: string;
  kind: "category" | "product";
  /** Sent as `categoryId` on multipart upload (edit mode). */
  categoryId?: string;
  /** Sent as `productId` on multipart upload (edit mode). */
  productId?: string;
  value: string;
  onUrlChange: (url: string) => void;
  showUrlInput?: boolean;
  /** When false, do not keep media id (e.g. gallery append). */
  trackMediaId?: boolean;
  helpText?: string;
};

export function MediaImageField({
  label,
  kind,
  categoryId,
  productId,
  value,
  onUrlChange,
  showUrlInput = true,
  trackMediaId = true,
  helpText,
}: MediaImageFieldProps) {
  const fid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [linkedId, setLinkedId] = useState<string | null>(null);

  useEffect(() => {
    if (!value) setLinkedId(null);
  }, [value]);

  async function postUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    if (categoryId) fd.append("categoryId", categoryId);
    if (productId) fd.append("productId", productId);
    const res = await fetch("/api/admin/media", { method: "POST", body: fd });
    let json: unknown = {};
    try {
      json = await res.json();
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) throw new Error(errorMessage(res, json));
    const { url, mediaId } = extractUploadResult(json);
    onUrlChange(url);
    setLinkedId(trackMediaId ? (mediaId ?? null) : null);
  }

  async function onPickUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);
    setUploading(true);
    try {
      await postUpload(file);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onPickReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);
    setUploading(true);
    try {
      if (linkedId) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/admin/media/${encodeURIComponent(linkedId)}/replace`, {
          method: "POST",
          body: fd,
        });
        let json: unknown = {};
        try {
          json = await res.json();
        } catch {
          /* ignore */
        }
        if (!res.ok) throw new Error(errorMessage(res, json));
        const { url } = extractUploadResult(json);
        onUrlChange(url);
      } else {
        await postUpload(file);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Replace failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function deleteFromServer() {
    if (!linkedId) return;
    if (!confirm("Delete this file from the media service and Cloudinary?")) return;
    setLocalError(null);
    try {
      const res = await fetch(`/api/admin/media/${encodeURIComponent(linkedId)}`, {
        method: "DELETE",
      });
      let json: unknown = {};
      try {
        json = await res.json();
      } catch {
        /* ignore */
      }
      if (!res.ok) throw new Error(errorMessage(res, json));
      onUrlChange("");
      setLinkedId(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="admin-field admin-media-field">
      <span className="admin-media-label">{label}</span>
      {helpText ? <p className="admin-media-help muted">{helpText}</p> : null}
      {localError ? (
        <p className="admin-media-err" role="alert">
          {localError}
        </p>
      ) : null}
      <div className="admin-media-row">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="admin-sr-only"
          aria-label={`${label} — choose file to upload`}
          onChange={(e) => void onPickUpload(e)}
          disabled={uploading}
        />
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Upload image"}
        </button>
        {linkedId ? (
          <>
            <input
              ref={replaceRef}
              type="file"
              accept="image/*"
              className="admin-sr-only"
              aria-label={`${label} — replace file`}
              onChange={(e) => void onPickReplace(e)}
              disabled={uploading}
            />
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              disabled={uploading}
              onClick={() => replaceRef.current?.click()}
            >
              Replace file
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-danger"
              disabled={uploading}
              onClick={() => void deleteFromServer()}
            >
              Delete from Cloudinary
            </button>
          </>
        ) : null}
        {value ? (
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            disabled={uploading}
            onClick={() => {
              onUrlChange("");
              setLinkedId(null);
            }}
          >
            Clear URL
          </button>
        ) : null}
      </div>
      {showUrlInput ? (
        <div className="admin-field" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
          <label className="admin-sr-only" htmlFor={`${fid}-url`}>
            Image URL
          </label>
          <input
            id={`${fid}-url`}
            className="admin-input"
            type="text"
            value={value}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://res.cloudinary.com/… or /local-path.png"
          />
        </div>
      ) : null}
      {value ? (
        <div className="admin-media-preview">
          <img src={value} alt="" width={120} height={120} style={{ objectFit: "contain" }} />
        </div>
      ) : null}
      {!linkedId && value ? (
        <p className="muted" style={{ fontSize: "0.75rem", marginTop: "0.35rem" }}>
          Replace / Cloudinary delete are available after you upload through this form (tracks media id).
        </p>
      ) : null}
    </div>
  );
}
