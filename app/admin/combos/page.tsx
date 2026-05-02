"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminComboRule, ComboThresholdUnit } from "../types";
import { parseMinTriggerBags } from "@/lib/comboRules/comboRulePayload";

const UNIT_OPTIONS: { value: ComboThresholdUnit; label: string }[] = [
  { value: "packets", label: "Packets" },
  { value: "bags", label: "Bags" },
  { value: "cartons", label: "Cartons" },
];

type CategoryOption = { id: string; name: string };

type ProductOption = {
  id: string;
  slug: string;
  comboKey: string;
  name: string;
  sku?: string;
  priceWithGst?: number;
  isEligibleForCombo?: unknown;
  categoryId: string;
  categoryName: string;
};

async function fetchCategoryOptions(): Promise<CategoryOption[]> {
  const res = await fetch("/api/admin/categories?includeInactive=true", { cache: "no-store" });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string; details?: string };
    const msg = typeof j.details === "string" ? j.details : typeof j.message === "string" ? j.message : "Failed to load categories";
    throw new Error(msg);
  }
  const json = (await res.json()) as { data?: { _id: string; name: string }[] };
  const rows = json.data ?? [];
  return rows.map((c) => ({ id: String(c._id), name: c.name }));
}

async function fetchAllProductOptions(): Promise<ProductOption[]> {
  const out: ProductOption[] = [];
  const limit = 500;
  let skip = 0;
  let total = 0;
  do {
    const res = await fetch(`/api/admin/products?limit=${limit}&skip=${skip}`, { cache: "no-store" });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string; details?: string };
      const msg = typeof j.details === "string" ? j.details : typeof j.message === "string" ? j.message : "Failed to load products";
      throw new Error(msg);
    }
    const json = (await res.json()) as {
      data?: Array<{
        _id: string;
        name: string;
        sku: string;
        slug?: string;
        pricing?: { priceWithGst?: number };
        isEligibleForCombo?: unknown;
        category?: { _id?: string; name?: string };
      }>;
      meta?: { total?: number };
    };
    const rows = json.data ?? [];
    total = typeof json.meta?.total === "number" ? json.meta.total : skip + rows.length;
    for (const p of rows) {
      const catObj = p.category && typeof p.category === "object" ? p.category : null;
      const categoryId =
        catObj && "_id" in catObj && catObj._id != null ? String(catObj._id) : "";
      const categoryName = typeof catObj?.name === "string" ? catObj.name : "";
      const rawSlug = typeof p.slug === "string" && p.slug.trim() ? p.slug.trim().toLowerCase() : "";
      const slug = rawSlug;
      const comboKey = rawSlug || `${toSlugLike(p.name) || "product"}--${String(p._id).toLowerCase()}`;
      out.push({
        id: String(p._id),
        slug,
        comboKey,
        name: p.name,
        sku: p.sku,
        priceWithGst:
          typeof p.pricing?.priceWithGst === "number" && Number.isFinite(p.pricing.priceWithGst)
            ? p.pricing.priceWithGst
            : undefined,
        isEligibleForCombo: p.isEligibleForCombo,
        categoryId,
        categoryName,
      });
    }
    skip += rows.length;
    if (rows.length === 0) break;
  } while (skip < total);
  return out;
}

function toggleSlug(slugs: string[], slug: string, on: boolean): string[] {
  const set = new Set(slugs);
  if (on) set.add(slug);
  else set.delete(slug);
  return [...set];
}

function toggleId(ids: string[], id: string, on: boolean): string[] {
  const set = new Set(ids);
  if (on) set.add(id);
  else set.delete(id);
  return [...set];
}

function normSlug(value: string): string {
  return String(value).trim().toLowerCase();
}

function toSlugLike(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildMinOrderLine(
  moq: number | undefined,
  moqBags: number | undefined,
  packetsPerBag: number
): string | undefined {
  const parts: string[] = [];
  if (packetsPerBag > 0) parts.push(`1 bag = ${packetsPerBag} packets`);
  if (moq != null && moq > 0) parts.push(`MOQ ${moq} packets`);
  if (moqBags != null && moqBags > 0 && packetsPerBag > 0) parts.push(`MOQ ${moqBags} bags`);
  return parts.length ? parts.join(" · ") : undefined;
}

function MultiCheckboxBlock({
  title,
  hint,
  error,
  idPrefix,
  search,
  showSearch = true,
  onSearchChange,
  loading,
  emptyMessage,
  options,
  selectedKeys,
  onToggle,
  onSelectAll,
  onClear,
}: {
  title: string;
  hint: string;
  error?: string | null;
  idPrefix: string;
  search: string;
  showSearch?: boolean;
  onSearchChange: (v: string) => void;
  loading: boolean;
  emptyMessage: string;
  options: { key: string; primary: string; secondary?: string; disabled?: boolean }[];
  selectedKeys: string[];
  onToggle: (key: string, checked: boolean) => void;
  onSelectAll?: (keys: string[]) => void;
  onClear: () => void;
}) {
  const n = selectedKeys.length;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          o.primary.toLowerCase().includes(q) || (o.secondary && o.secondary.toLowerCase().includes(q))
      )
    : options;

  return (
    <div className="admin-field">
      <label>{title}</label>
      <p className="admin-multiselect-hint">{hint}</p>
      {error ? (
        <p
          className="admin-multiselect-hint"
          role="alert"
          style={{ color: "#991b1b", marginTop: "0.25rem", fontWeight: 500 }}
        >
          {error}
        </p>
      ) : null}
      <div className="admin-multiselect" aria-busy={loading}>
        <div className="admin-multiselect-toolbar">
          {showSearch ? (
            <input
              type="search"
              placeholder="Filter…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              disabled={loading}
              autoComplete="off"
              aria-label={`Filter ${title}`}
            />
          ) : (
            <div aria-hidden="true" />
          )}
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => onSelectAll?.(options.filter((o) => !o.disabled).map((o) => o.key))}
            disabled={loading || options.length === 0 || !onSelectAll}
          >
            Select all ({options.length})
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={onClear}
            disabled={loading || n === 0}
          >
            Clear ({n})
          </button>
        </div>
        {loading ? (
          <div className="admin-multiselect-empty">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="admin-multiselect-empty">{emptyMessage}</div>
        ) : (
          <div className="admin-multiselect-list" role="group" style={{ maxHeight: "14rem", overflowY: "auto" }}>
            {filtered.map((o) => {
              const checked = selectedKeys.includes(o.key);
              const disabled = Boolean(o.disabled);
              const domId = `${idPrefix}-${o.key.replace(/[^a-z0-9_-]/gi, "_")}`;
              return (
                <div className="admin-multiselect-row" key={o.key}>
                  <input
                    type="checkbox"
                    id={domId}
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onToggle(o.key, e.target.checked)}
                  />
                  <label htmlFor={domId} style={disabled ? { opacity: 0.65, cursor: "not-allowed" } : undefined}>
                    {o.primary}
                    {o.secondary ? <span className="admin-multiselect-meta">{o.secondary}</span> : null}
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const emptyForm = {
  name: "",
  triggerCategoryIds: [] as string[],
  triggerProductSlugs: [] as string[],
  targetProductSlugs: [] as string[],
  fallbackTargetProductSlugs: [] as string[],
  minTriggerBags: "3",
  minTargetBags: "1",
  triggerThresholdUnit: "bags" as ComboThresholdUnit,
  targetThresholdUnit: "bags" as ComboThresholdUnit,
  suggestionMessage: "",
  isActive: true,
};

type ComboFormFieldErrorKey =
  | "name"
  | "triggerCategories"
  | "triggerProducts"
  | "targetProducts"
  | "fallbackProducts"
  | "minTrigger"
  | "maxTargetCombo"
  | "suggestion";

export default function AdminCombosPage() {
  const [list, setList] = useState<AdminComboRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ComboFormFieldErrorKey, string>>>({});
  const [modalSaveError, setModalSaveError] = useState<string | null>(null);

  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [searchTrigCat, setSearchTrigCat] = useState("");
  const [searchTrigProd, setSearchTrigProd] = useState("");
  const [searchTgtProd, setSearchTgtProd] = useState("");
  const [searchFallbackTgtProd, setSearchFallbackTgtProd] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/combo-rules");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      setList(json.data as AdminComboRule[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    setOptionsError(null);
    setOptionsLoading(true);
    setSearchTrigCat("");
    setSearchTrigProd("");
    setSearchTgtProd("");
    setSearchFallbackTgtProd("");
    void (async () => {
      try {
        const [cats, prods] = await Promise.all([fetchCategoryOptions(), fetchAllProductOptions()]);
        if (cancelled) return;
        setCategoryOptions(cats);
        setProductOptions(prods);
      } catch (e) {
        if (!cancelled) {
          setOptionsError(e instanceof Error ? e.message : "Could not load lists");
          setCategoryOptions([]);
          setProductOptions([]);
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen]);

  const triggerProductsForPicker = useMemo(() => {
    const catIds = form.triggerCategoryIds;
    if (catIds.length === 0) return [];
    const set = new Set(catIds);
    const blockedSlugs = new Set([
      ...form.targetProductSlugs.map(normSlug),
      ...form.fallbackTargetProductSlugs.map(normSlug),
    ]);
    return productOptions.filter(
      (p) =>
        p.categoryId &&
        set.has(p.categoryId) &&
        !blockedSlugs.has(normSlug(p.comboKey))
    );
  }, [
    productOptions,
    form.triggerCategoryIds,
    form.targetProductSlugs,
    form.fallbackTargetProductSlugs,
  ]);

  const triggerSlugSetForPicker = useMemo(
    () => new Set(form.triggerProductSlugs.map(normSlug)),
    [form.triggerProductSlugs]
  );

  const targetProductsForPicker = useMemo(() => {
    return productOptions.filter(
      (p) =>
        !triggerSlugSetForPicker.has(normSlug(p.comboKey))
    );
  }, [productOptions, triggerSlugSetForPicker]);

  const fallbackProductsForPicker = useMemo(() => {
    return productOptions.filter(
      (p) =>
        !triggerSlugSetForPicker.has(normSlug(p.comboKey))
    );
  }, [productOptions, triggerSlugSetForPicker]);

  useEffect(() => {
    if (productOptions.length === 0) return;
    const catIds = form.triggerCategoryIds;
    if (catIds.length === 0) return;
    const catSet = new Set(catIds);
    const allowed = new Set(
      productOptions.filter((p) => p.categoryId && catSet.has(p.categoryId)).map((p) => normSlug(p.comboKey))
    );
    setForm((f) => {
      const next = f.triggerProductSlugs.filter((s) => allowed.has(normSlug(s)));
      if (next.length === f.triggerProductSlugs.length) return f;
      return { ...f, triggerProductSlugs: next };
    });
  }, [form.triggerCategoryIds, productOptions]);

  useEffect(() => {
    setForm((f) => {
      if (f.triggerProductSlugs.length === 0) return f;
      const blocked = new Set([
        ...f.targetProductSlugs.map(normSlug),
        ...f.fallbackTargetProductSlugs.map(normSlug),
      ]);
      const next = f.triggerProductSlugs.filter((slug) => !blocked.has(normSlug(slug)));
      if (next.length === f.triggerProductSlugs.length) return f;
      return { ...f, triggerProductSlugs: next };
    });
  }, [form.targetProductSlugs, form.fallbackTargetProductSlugs]);

  useEffect(() => {
    const trig = new Set(form.triggerProductSlugs.map(normSlug));
    setForm((f) => {
      const nextTgt = f.targetProductSlugs.filter((s) => !trig.has(normSlug(s)));
      const nextFb = f.fallbackTargetProductSlugs.filter((s) => !trig.has(normSlug(s)));
      if (nextTgt.length === f.targetProductSlugs.length && nextFb.length === f.fallbackTargetProductSlugs.length)
        return f;
      return { ...f, targetProductSlugs: nextTgt, fallbackTargetProductSlugs: nextFb };
    });
  }, [form.triggerProductSlugs]);

  function clearFieldError(key: ComboFormFieldErrorKey) {
    setFieldErrors((er) => {
      if (!(key in er)) return er;
      const next = { ...er };
      delete next[key];
      return next;
    });
  }

  function closeModal() {
    setModalOpen(false);
    setFieldErrors({});
    setModalSaveError(null);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFieldErrors({});
    setModalSaveError(null);
    setModalOpen(true);
  }

  function openEdit(rule: AdminComboRule) {
    setEditingId(rule._id);
    setForm({
      name: rule.name,
      triggerCategoryIds: rule.triggerCategoryIds ?? [],
      triggerProductSlugs: [...(rule.triggerSlugs ?? [])],
      targetProductSlugs: [...(rule.targetSlugs ?? [])],
      fallbackTargetProductSlugs: [...(rule.fallbackTargetSlugs ?? [])],
      minTriggerBags: String(rule.minTriggerBags ?? 3),
      minTargetBags: String(
        rule.minTargetBags !== undefined && rule.minTargetBags !== null ? rule.minTargetBags : 1
      ),
      triggerThresholdUnit: rule.triggerThresholdUnit ?? "bags",
      targetThresholdUnit: rule.targetThresholdUnit ?? "bags",
      suggestionMessage: rule.suggestionMessage ?? "",
      isActive: rule.isActive,
    });
    setFieldErrors({});
    setModalSaveError(null);
    setModalOpen(true);
  }

  function buildBody(): Record<string, unknown> {
    const trigStr = String(form.minTriggerBags ?? "").trim();
    const tgtStr = String(form.minTargetBags ?? "").trim();
    return {
      name: form.name.trim(),
      triggerSlugs: form.triggerProductSlugs,
      targetSlugs: form.targetProductSlugs,
      fallbackTargetSlugs: form.fallbackTargetProductSlugs,
      triggerCategoryIds: form.triggerCategoryIds,
      minTriggerBags: parseMinTriggerBags(trigStr === "" ? undefined : trigStr, 3),
      minTargetBags: parseMinTriggerBags(tgtStr === "" ? undefined : tgtStr, 1),
      triggerThresholdUnit: form.triggerThresholdUnit,
      targetThresholdUnit: form.targetThresholdUnit,
      suggestionMessage: form.suggestionMessage.trim(),
      isActive: form.isActive,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalSaveError(null);
    const nextErrors: Partial<Record<ComboFormFieldErrorKey, string>> = {};
    const nameTrim = form.name.trim();
    if (!nameTrim) nextErrors.name = "Enter a rule name.";

    if (form.triggerCategoryIds.length === 0) {
      nextErrors.triggerCategories = "Select at least one trigger category.";
    }
    if (form.triggerProductSlugs.length === 0) {
      nextErrors.triggerProducts = "Select at least one trigger product.";
    }
    if (form.targetProductSlugs.length === 0) {
      nextErrors.targetProducts = "Select at least one combo target product.";
    }
    if (form.fallbackTargetProductSlugs.length === 0) {
      nextErrors.fallbackProducts = "Select at least one fallback product.";
    }

    const trigStr = String(form.minTriggerBags ?? "").trim();
    if (trigStr === "") {
      nextErrors.minTrigger = "Enter the trigger minimum quantity.";
    } else {
      const nTrig = Number(trigStr);
      if (!Number.isFinite(nTrig) || nTrig < 0 || !Number.isInteger(nTrig)) {
        nextErrors.minTrigger = "Enter a whole number zero or greater.";
      }
    }

    const tgtStr = String(form.minTargetBags ?? "").trim();
    if (tgtStr === "") {
      nextErrors.maxTargetCombo = "Enter the max target quantity at combo price.";
    } else {
      const nTgt = Number(tgtStr);
      if (!Number.isFinite(nTgt) || nTgt < 0 || !Number.isInteger(nTgt)) {
        nextErrors.maxTargetCombo = "Enter a whole number zero or greater.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const body = buildBody();
      const url = editingId ? `/api/admin/combo-rules/${editingId}` : "/api/admin/combo-rules";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      closeModal();
      await load();
    } catch (err) {
      setModalSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(rule: AdminComboRule) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/combo-rules/${rule._id}`, {
        method: "PATCH",    
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  const categoryRowsForMulti = useMemo(
    () => categoryOptions.map((c) => ({ key: c.id, primary: c.name, secondary: c.id })),
    [categoryOptions]
  );

  const triggerProdRows = useMemo(
    () =>
      triggerProductsForPicker.map((p) => ({
        key: p.comboKey,
        primary: p.name,
        secondary: `${p.sku ?? "—"} · ${p.categoryName || "—"}${p.slug ? "" : " · Uses name key"}`,
      })),
    [triggerProductsForPicker]
  );

  const targetProdRows = useMemo(
    () =>
      targetProductsForPicker.map((p) => ({
        key: p.comboKey,
        primary: p.name,
        secondary: `${p.sku ?? "—"} · ${p.categoryName || "—"} · ₹${
          typeof p.priceWithGst === "number" ? p.priceWithGst.toFixed(2) : "—"
        }${p.slug ? "" : " · Uses name key"}`,
      })),
    [targetProductsForPicker]
  );

  const fallbackProdRows = useMemo(
    () =>
      fallbackProductsForPicker.map((p) => ({
        key: p.comboKey,
        primary: p.name,
        secondary: `${p.sku ?? "—"} · ${p.categoryName || "—"} · ₹${
          typeof p.priceWithGst === "number" ? p.priceWithGst.toFixed(2) : "—"
        }${p.slug ? "" : " · Uses name key"}`,
      })),
    [fallbackProductsForPicker]
  );

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Combo rules</h1>
      <p className="muted" style={{ maxWidth: "48rem", marginBottom: "1rem" }}>
        Pick categories and/or products for triggers and targets. Categories apply to every active product in that category;
        specific products add or narrow selection. Combo net pricing comes from each combo product&apos;s catalog size row
        (separate listings). Thresholds control trigger pool size and the maximum target amount at combo rates.
      </p>

      {error ? (
        <div className="admin-banner err" role="alert">
          {error}
        </div>
      ) : null}

      {optionsError && modalOpen ? (
        <div className="admin-banner err" role="alert">
          {optionsError}
        </div>
      ) : null}

      <div className="admin-toolbar">
        {list.length === 0 ? (
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={openCreate}
          >
            Create combo rule
          </button>
        ) : (
          <span className="muted" style={{ fontSize: "0.9rem" }}>
            Only one combo rule is allowed. Use Edit or toggle Active/Inactive.
          </span>
        )}
        <button type="button" className="admin-btn admin-btn-ghost" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--nowrap">
            <thead>
              <tr>
                <th>Name</th>
                <th>Triggers</th>
                <th>Targets</th>
                <th>Trigger / target max</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r._id}>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      {(r.triggerCategoryIds?.length ?? 0) > 0
                        ? `${r.triggerCategoryIds!.length} cat(s) + `
                        : ""}
                      {(r.triggerSlugs ?? []).length} product slug(s)
                    </span>
                  </td>
                  <td>
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      {(r.targetSlugs ?? []).length} combo slug(s), {(r.fallbackTargetSlugs ?? []).length} fallback slug(s)
                    </span>
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>
                    {r.minTriggerBags ?? 3} {r.triggerThresholdUnit ?? "bags"} → max {r.minTargetBags ?? 1}{" "}
                    {r.targetThresholdUnit ?? "bags"}
                  </td>
                  <td>{r.isActive ? "Yes" : "No"}</td>
                  <td className="admin-combo-actions-cell">
                    <button
                      type="button"
                      className={`admin-btn ${r.isActive ? "admin-btn-ghost" : "admin-btn-primary"}`}
                      style={{ marginRight: 6 }}
                      onClick={() => void handleToggleActive(r)}
                    >
                      {r.isActive ? "Turn Off" : "Turn On"}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() => openEdit(r)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 ? <p className="muted" style={{ padding: "1rem" }}>No combo rules yet.</p> : null}
        </div>
      )}

      {modalOpen ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) closeModal();
          }}
        >
          <div className="admin-modal wide admin-combo-modal" role="dialog" aria-labelledby="combo-modal-title">
            <h2 id="combo-modal-title">{editingId ? "Edit combo rule" : "New combo rule"}</h2>
            <form key={editingId ?? "new"} className="admin-modal-form admin-combo-modal-form" onSubmit={(e) => void handleSubmit(e)}>
              {modalSaveError ? (
                <div className="admin-banner err" role="alert" style={{ marginBottom: "0.75rem" }}>
                  {modalSaveError}
                </div>
              ) : null}
              <div className="admin-form-section">
                <h3 className="admin-form-section-title">Combo details</h3>
                <div className="admin-field">
                  <label htmlFor="combo-name">Name *</label>
                  <input
                    id="combo-name"
                    className="admin-input"
                    value={form.name}
                    onChange={(e) => {
                      clearFieldError("name");
                      setForm((f) => ({ ...f, name: e.target.value }));
                    }}
                    placeholder="e.g. Standard Combo Offer"
                    aria-invalid={fieldErrors.name ? true : undefined}
                    aria-describedby={fieldErrors.name ? "combo-name-err" : undefined}
                  />
                  {fieldErrors.name ? (
                    <p id="combo-name-err" className="admin-multiselect-hint" role="alert" style={{ color: "#991b1b", fontWeight: 500 }}>
                      {fieldErrors.name}
                    </p>
                  ) : null}
                </div>

                <MultiCheckboxBlock
                  title="Trigger categories *"
                  hint="Select one or more categories. The trigger product list only shows products from these categories."
                  error={fieldErrors.triggerCategories}
                  idPrefix="trig-cat"
                  search={searchTrigCat}
                  onSearchChange={setSearchTrigCat}
                  loading={optionsLoading}
                  emptyMessage="No categories found."
                  options={categoryRowsForMulti}
                  selectedKeys={form.triggerCategoryIds}
                  onToggle={(key, checked) => {
                    clearFieldError("triggerCategories");
                    setForm((f) => ({ ...f, triggerCategoryIds: toggleId(f.triggerCategoryIds, key, checked) }));
                  }}
                  onSelectAll={(keys) => {
                    clearFieldError("triggerCategories");
                    setForm((f) => ({
                      ...f,
                      triggerCategoryIds: [...new Set([...f.triggerCategoryIds, ...keys])],
                    }));
                  }}
                  onClear={() => {
                    clearFieldError("triggerCategories");
                    setForm((f) => ({ ...f, triggerCategoryIds: [] }));
                  }}
                />

                <MultiCheckboxBlock
                  title="Trigger products *"
                  hint="Qualifying products (from trigger categories). These products are not listed under target or fallback."
                  error={fieldErrors.triggerProducts}
                  idPrefix="trig-prod"
                  search={searchTrigProd}
                  onSearchChange={setSearchTrigProd}
                  loading={optionsLoading}
                  emptyMessage={
                    form.triggerCategoryIds.length > 0
                      ? "No products in the selected categories."
                      : "Please select a trigger category first."
                  }
                  options={triggerProdRows}
                  selectedKeys={form.triggerProductSlugs}
                  onToggle={(key, checked) => {
                    clearFieldError("triggerProducts");
                    setForm((f) => ({ ...f, triggerProductSlugs: toggleSlug(f.triggerProductSlugs, key, checked) }));
                  }}
                  onSelectAll={(keys) => {
                    clearFieldError("triggerProducts");
                    setForm((f) => ({
                      ...f,
                      triggerProductSlugs: [...new Set([...f.triggerProductSlugs, ...keys])],
                    }));
                  }}
                  onClear={() => {
                    clearFieldError("triggerProducts");
                    setForm((f) => ({ ...f, triggerProductSlugs: [] }));
                  }}
                />
              </div>

              <div className="admin-form-section">
              <h3 className="admin-form-section-title">Target and fallback setup</h3>
              <div className="admin-field-row admin-combo-grid-two">
                <div className="admin-combo-col">
                  <MultiCheckboxBlock
                    title="Target products (combo) *"
                    hint="Combo-priced products after trigger condition is met. Search across all products; trigger products are hidden here."
                    error={fieldErrors.targetProducts}
                    idPrefix="tgt-prod"
                    search={searchTgtProd}
                    showSearch
                    onSearchChange={setSearchTgtProd}
                    loading={optionsLoading}
                    emptyMessage={
                      searchTgtProd.trim()
                        ? "No products found."
                        : "Type in search to see products."
                    }
                    options={searchTgtProd.trim() ? targetProdRows : []}
                    selectedKeys={form.targetProductSlugs}
                    onToggle={(key, checked) => {
                      clearFieldError("targetProducts");
                      setForm((f) => {
                        const nextTargets = checked
                          ? [...new Set([...f.targetProductSlugs, key])].slice(0, 2)
                          : f.targetProductSlugs.filter((s) => s !== key);
                        return {
                          ...f,
                          targetProductSlugs: nextTargets,
                          fallbackTargetProductSlugs: checked
                            ? toggleSlug(f.fallbackTargetProductSlugs, key, false)
                            : f.fallbackTargetProductSlugs,
                        };
                      });
                    }}
                    onSelectAll={(keys) => {
                      clearFieldError("targetProducts");
                      const picked = [...new Set(keys)].slice(0, 2);
                      setForm((f) => {
                        if (picked.length === 0) return f;
                        const nextFallback = f.fallbackTargetProductSlugs.filter(
                          (s) => !picked.includes(s)
                        );
                        return {
                          ...f,
                          targetProductSlugs: picked,
                          fallbackTargetProductSlugs: nextFallback,
                        };
                      });
                    }}
                    onClear={() => {
                      clearFieldError("targetProducts");
                      setForm((f) => ({ ...f, targetProductSlugs: [] }));
                    }}
                  />
                </div>
                <div className="admin-combo-col">
                  <MultiCheckboxBlock
                    title="Fallback products *"
                    hint="Regular price before combo unlocks. Search across all products. Same product cannot be both target and fallback; trigger products are hidden here."
                    error={fieldErrors.fallbackProducts}
                    idPrefix="fallback-tgt-prod"
                    search={searchFallbackTgtProd}
                    showSearch
                    onSearchChange={setSearchFallbackTgtProd}
                    loading={optionsLoading}
                    emptyMessage={
                      searchFallbackTgtProd.trim()
                        ? "No products found."
                        : "Type in search to see products."
                    }
                    options={searchFallbackTgtProd.trim() ? fallbackProdRows : []}
                    selectedKeys={form.fallbackTargetProductSlugs}
                    onToggle={(key, checked) => {
                      clearFieldError("fallbackProducts");
                      setForm((f) => {
                        const nextFallback = checked
                          ? [...new Set([...f.fallbackTargetProductSlugs, key])].slice(0, 2)
                          : f.fallbackTargetProductSlugs.filter((s) => s !== key);
                        return {
                          ...f,
                          fallbackTargetProductSlugs: nextFallback,
                          targetProductSlugs: checked
                            ? toggleSlug(f.targetProductSlugs, key, false)
                            : f.targetProductSlugs,
                        };
                      });
                    }}
                    onSelectAll={(keys) => {
                      clearFieldError("fallbackProducts");
                      const picked = [...new Set(keys)].slice(0, 2);
                      setForm((f) => {
                        if (picked.length === 0) return f;
                        const nextTargets = f.targetProductSlugs.filter((s) => !picked.includes(s));
                        return {
                          ...f,
                          fallbackTargetProductSlugs: picked,
                          targetProductSlugs: nextTargets,
                        };
                      });
                    }}
                    onClear={() => {
                      clearFieldError("fallbackProducts");
                      setForm((f) => ({ ...f, fallbackTargetProductSlugs: [] }));
                    }}
                  />
                </div>
              </div>
              </div>

              <div className="admin-form-section">
              <h3 className="admin-form-section-title">Threshold and messaging</h3>
              <div className="admin-field">
                <span className="muted" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.85rem" }}>
                  Trigger minimum quantity
                </span>
                <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.5rem" }}>
                  Users must add at least this trigger quantity in cart to unlock combo pricing.
                </p>
                <div className="admin-field-row" style={{ alignItems: "flex-end" }}>
                  <div className="admin-field" style={{ flex: 1 }}>
                    <label htmlFor="combo-min-trig">Amount *</label>
                    <input
                      id="combo-min-trig"
                      type="number"
                      min={0}
                      step={1}
                      value={form.minTriggerBags}
                      onChange={(e) => {
                        clearFieldError("minTrigger");
                        setForm((f) => ({ ...f, minTriggerBags: e.target.value }));
                      }}
                      aria-invalid={fieldErrors.minTrigger ? true : undefined}
                      aria-describedby={fieldErrors.minTrigger ? "combo-min-trig-err" : undefined}
                    />
                    {fieldErrors.minTrigger ? (
                      <p id="combo-min-trig-err" role="alert" style={{ color: "#991b1b", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
                        {fieldErrors.minTrigger}
                      </p>
                    ) : null}
                  </div>
                  <div className="admin-field" style={{ flex: 1 }}>
                    <label htmlFor="combo-trig-unit">Unit *</label>
                    <select
                      id="combo-trig-unit"
                      value={form.triggerThresholdUnit}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, triggerThresholdUnit: e.target.value as ComboThresholdUnit }))
                      }
                    >
                      {UNIT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="admin-field">
                <span className="muted" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.85rem" }}>
                  Target max quantity at combo price
                </span>
                <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.5rem" }}>
                  This is the maximum target quantity allowed at combo price. Above this limit, normal pricing applies.
                </p>
                <div className="admin-field-row" style={{ alignItems: "flex-end" }}>
                  <div className="admin-field" style={{ flex: 1 }}>
                    <label htmlFor="combo-min-tgt">Amount *</label>
                    <input
                      id="combo-min-tgt"
                      type="number"
                      min={0}
                      step={1}
                      value={form.minTargetBags}
                      onChange={(e) => {
                        clearFieldError("maxTargetCombo");
                        setForm((f) => ({ ...f, minTargetBags: e.target.value }));
                      }}
                      aria-invalid={fieldErrors.maxTargetCombo ? true : undefined}
                      aria-describedby={fieldErrors.maxTargetCombo ? "combo-min-tgt-err" : undefined}
                    />
                    {fieldErrors.maxTargetCombo ? (
                      <p id="combo-min-tgt-err" role="alert" style={{ color: "#991b1b", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
                        {fieldErrors.maxTargetCombo}
                      </p>
                    ) : null}
                  </div>
                  <div className="admin-field" style={{ flex: 1 }}>
                    <label htmlFor="combo-tgt-unit">Unit *</label>
                    <select
                      id="combo-tgt-unit"
                      value={form.targetThresholdUnit}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, targetThresholdUnit: e.target.value as ComboThresholdUnit }))
                      }
                    >
                      {UNIT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="admin-field">
                <label htmlFor="combo-msg">Customer message (optional)</label>
                <textarea
                  id="combo-msg"
                  value={form.suggestionMessage}
                  onChange={(e) => {
                    clearFieldError("suggestion");
                    setForm((f) => ({ ...f, suggestionMessage: e.target.value }));
                  }}
                  rows={2}
                  placeholder="Shown on product detail and cart (required)."
                  // aria-invalid={fieldErrors.suggestion ? true : undefined}
                  // aria-describedby={fieldErrors.suggestion ? "combo-msg-err" : undefined}
                />
                {/* {fieldErrors.suggestion ? (
                  <p id="combo-msg-err" role="alert" style={{ color: "#991b1b", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
                    {fieldErrors.suggestion}
                  </p>
                ) : null} */}
              </div>

              <div className="admin-field-row">
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}
