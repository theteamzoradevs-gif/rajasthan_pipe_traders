"use client";

import { useCallback, useEffect, useState } from "react";

export default function AdminSettingsPage() {
  const [minimumOrderInclGst, setMinimumOrderInclGst] = useState("");
  const [pricesEffectiveDate, setPricesEffectiveDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/app-settings", {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      const n = json.data?.minimumOrderInclGst;
      const d = json.data?.pricesEffectiveDate;
      setMinimumOrderInclGst(typeof n === "number" ? String(n) : "25000");
      setPricesEffectiveDate(typeof d === "string" ? d : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const n = Number(minimumOrderInclGst.trim());
      if (!Number.isFinite(n) || n < 0) throw new Error("Enter a valid minimum order amount");
      const trimmedDate = pricesEffectiveDate.trim();
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          minimumOrderInclGst: n,
          pricesEffectiveDate: trimmedDate,
        }),
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      
      setSaved(true);
      // Keep the values the user just saved (don't reload from DB)
      setMinimumOrderInclGst(String(n));
      setPricesEffectiveDate(trimmedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Store settings</h1>
      <p className="muted" style={{ maxWidth: "40rem" }}>
        These settings control how your store checkout works. The minimum order amount is checked on the full cart total
        (including GST) before any coupon discount is applied.
      </p>

      {error ? (
        <div className="admin-banner err" role="alert">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="admin-banner" role="status">
          Saved.
        </div>
      ) : null}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <form onSubmit={(e) => void handleSave(e)} className="admin-form-section" style={{ maxWidth: "24rem" }}>
          <div className="admin-field">
            <label htmlFor="mov">Minimum order amount (including GST), ₹</label>
            <input
              id="mov"
              className="admin-input"
              type="number"
              min={0}
              step={1}
              value={minimumOrderInclGst}
              onChange={(e) => setMinimumOrderInclGst(e.target.value)}
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="ped">Price list date</label>
            <input
              id="ped"
              className="admin-input"
              type="text"
              placeholder="For example: 26-04-2026"
              value={pricesEffectiveDate}
              onChange={(e) => setPricesEffectiveDate(e.target.value)}
            />
          </div>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </div>
  );
}
