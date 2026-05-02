"use client";

import { useId, useRef, useState } from "react";
import { extractUploadResult } from "@/lib/media-upload-result";

type BannerPayload = {
  trustBadgeText: string;
  headlinePart1: string;
  headlinePart2: string;
  tagline: string;
  subtextHtml: string;
  stats: { value: string; label: string }[];
  backgroundImageUrl: string;
  carouselSlides: { tag: string; tagKey: string; productId: string }[];
};

/** Same fields as the banner form (before server-side defaults); used to PATCH without dropping unsaved edits */
export type BannerDraftForPatch = {
  trustBadgeText: string;
  headlinePart1: string;
  headlinePart2: string;
  tagline: string;
  subtextHtml: string;
  stats: { value: string; label: string }[];
  carouselSlides: { tag: string; tagKey: string; productId: string }[];
};

function cleanForPatch(draft: BannerDraftForPatch): Omit<BannerPayload, "backgroundImageUrl"> {
  const stats = draft.stats
    .map((s) => ({ value: s.value.trim(), label: s.label.trim() }))
    .filter((s) => s.value && s.label);
  const carouselSlides = draft.carouselSlides
    .map((s) => ({
      tag: s.tag.trim(),
      tagKey: s.tagKey.trim(),
      productId: s.productId.trim(),
    }))
    .filter((s) => s.tag && s.productId);
  return {
    trustBadgeText: draft.trustBadgeText,
    headlinePart1: draft.headlinePart1,
    headlinePart2: draft.headlinePart2,
    tagline: draft.tagline,
    subtextHtml: draft.subtextHtml,
    stats,
    carouselSlides,
  };
}

function errorMessage(res: Response, json: unknown): string {
  if (json && typeof json === "object" && "message" in json) {
    const m = (json as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return res.statusText || "Request failed";
}

export type BannerBackgroundCloudProps = {
  value: string;
  onUrlChange: (url: string) => void;
  /** Current form snapshot for PATCH (keeps unsaved headline / carousel edits when uploading) */
  getPatchPayload: () => BannerDraftForPatch;
  /** Fires after the URL is stored in MongoDB via the banner API */
  onPersisted?: () => void;
};

/**
 * Uploads a hero background image to Cloudinary (`/api/admin/media` with kind `banner`),
 * then PATCHes `backgroundImageUrl` in MongoDB together with {@link getPatchPayload}.
 */
export function BannerBackgroundCloud({
  value,
  onUrlChange,
  getPatchPayload,
  onPersisted,
}: BannerBackgroundCloudProps) {
  const fid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function persistBannerUrl(secureUrl: string) {
    const base = cleanForPatch(getPatchPayload());
    const res = await fetch("/api/admin/banner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...base,
        backgroundImageUrl: secureUrl,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(typeof json.message === "string" ? json.message : res.statusText);
    const saved = json.data as BannerPayload;
    onUrlChange(saved.backgroundImageUrl);
    onPersisted?.();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "banner");
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      let json: unknown = {};
      try {
        json = await res.json();
      } catch {
        /* non-JSON */
      }
      if (!res.ok) throw new Error(errorMessage(res, json));
      const { url } = extractUploadResult(json);
      await persistBannerUrl(url);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="admin-field" style={{ marginBottom: "0.75rem" }}>
      <span className="admin-media-label">Background image URL</span>
      <p className="muted" style={{ marginTop: "0.25rem", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
        Paste a path or URL below, or upload to Cloudinary (folder <code>…/banner/</code>); upload saves the HTTPS URL
        in MongoDB immediately.
      </p>
      {localError ? (
        <p className="admin-media-err" role="alert" style={{ marginBottom: "0.5rem" }}>
          {localError}
        </p>
      ) : null}
      <div className="admin-media-row">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="admin-sr-only"
          aria-label="Upload banner background to Cloudinary"
          onChange={(e) => void onPick(e)}
          disabled={uploading}
        />
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Uploading & saving…" : "Upload to Cloudinary & save"}
        </button>
      </div>
      {value ? (
        <div className="admin-media-preview" style={{ marginTop: "0.75rem" }}>
          <img src={value} alt="" width={160} height={100} style={{ objectFit: "contain", maxWidth: "100%" }} />
        </div>
      ) : null}
      <label className="admin-sr-only" htmlFor={`${fid}-url`}>
        Background image URL
      </label>
      <input
        id={`${fid}-url`}
        className="admin-input"
        type="text"
        value={value}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="https://res.cloudinary.com/… or /banner-1.png"
        style={{ marginTop: "0.75rem" }}
        autoComplete="off"
      />
    </div>
  );
}
