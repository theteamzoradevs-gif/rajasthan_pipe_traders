"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminCoupon, CouponPacketTier } from "../types";

const defaultTiers: CouponPacketTier[] = [
  { minPackets: 15, value: 7 },
  { minPackets: 30, value: 8 },
  { minPackets: 50, value: 9 },
  { minPackets: 85, value: 12 },
];

type CategoryOption = { id: string; name: string };

type ProductOption = {
  id: string;
  name: string;
  sku?: string;
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
        sku?: string;
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
      out.push({
        id: String(p._id),
        name: p.name,
        sku: p.sku,
        categoryId,
        categoryName,
      });
    }
    skip += rows.length;
    if (rows.length === 0) break;
  } while (skip < total);
  return out;
}

function toggleId(ids: string[], id: string, on: boolean): string[] {
  const set = new Set(ids);
  if (on) set.add(id);
  else set.delete(id);
  return [...set];
}

const emptyForm = {
  code: "",
  name: "",
  description: "",
  discountType: "percentage" as AdminCoupon["discountType"],
  tierUnit: "packets" as AdminCoupon["tierUnit"],
  packetTiers: defaultTiers.map((t) => ({ ...t })),
  applicableProductIds: [] as string[],
  applicableCategoryIds: [] as string[],
  isActive: true,
};

function MultiCheckboxBlock({
  title,
  hint,
  idPrefix,
  search,
  onSearchChange,
  loading,
  emptyMessage,
  options,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
}: {
  title: string;
  hint: string;
  idPrefix: string;
  search: string;
  onSearchChange: (v: string) => void;
  loading: boolean;
  emptyMessage: string;
  options: { id: string; primary: string; secondary?: string }[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onSelectAll?: (ids: string[]) => void;
  onClear: () => void;
}) {
  const n = selectedIds.length;
  return (
    <div className="admin-field">
      <label>{title}</label>
      <p className="admin-multiselect-hint">{hint}</p>
      <div className="admin-multiselect" aria-busy={loading}>
        <div className="admin-multiselect-toolbar">
          <input
            type="search"
            className="admin-input"
            placeholder="Filter…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={loading}
            autoComplete="off"
            aria-label={`Filter ${title}`}
          />
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => onSelectAll?.(options.map((o) => o.id))}
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
        ) : options.length === 0 ? (
          <div className="admin-multiselect-empty">{emptyMessage}</div>
        ) : (
          <div className="admin-multiselect-list" role="group">
            {options.map((o) => {
              const checked = selectedIds.includes(o.id);
              const domId = `${idPrefix}-${o.id}`;
              return (
                <div className="admin-multiselect-row" key={o.id}>
                  <input
                    type="checkbox"
                    id={domId}
                    checked={checked}
                    onChange={(e) => onToggle(o.id, e.target.checked)}
                  />
                  <label htmlFor={domId}>
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

export default function AdminCouponsPage() {
  const [list, setList] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/coupons");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      setList(json.data as AdminCoupon[]);
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
    setCategorySearch("");
    setProductSearch("");
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

  /** When categories are selected, the product picker only lists products in those categories. */
  const productsForPicker = useMemo(() => {
    const catIds = form.applicableCategoryIds;
    if (catIds.length === 0) return productOptions;
    const set = new Set(catIds);
    return productOptions.filter((p) => p.categoryId && set.has(p.categoryId));
  }, [productOptions, form.applicableCategoryIds]);

  useEffect(() => {
    if (productOptions.length === 0) return;
    const catIds = form.applicableCategoryIds;
    if (catIds.length === 0) return;
    const catSet = new Set(catIds);
    const allowed = new Set(
      productOptions.filter((p) => p.categoryId && catSet.has(p.categoryId)).map((p) => p.id)
    );
    setForm((f) => {
      const next = f.applicableProductIds.filter((id) => allowed.has(id));
      if (next.length === f.applicableProductIds.length) return f;
      return { ...f, applicableProductIds: next };
    });
  }, [form.applicableCategoryIds, productOptions]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categoryOptions;
    return categoryOptions.filter((c) => c.name.toLowerCase().includes(q));
  }, [categoryOptions, categorySearch]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return productsForPicker;
    return productsForPicker.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
      );
    });
  }, [productsForPicker, productSearch]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(c: AdminCoupon) {
    setEditingId(c._id);
    setForm({
      code: c.code,
      name: c.name,
      description: c.description ?? "",
      discountType: c.discountType,
      tierUnit: c.tierUnit === "outer" ? "outer" : "packets",
      packetTiers:
        c.packetTiers?.length > 0
          ? c.packetTiers.map((t) => ({ minPackets: t.minPackets, value: t.value }))
          : defaultTiers.map((t) => ({ ...t })),
      applicableProductIds: [...(c.applicableProductIds ?? [])],
      applicableCategoryIds: [...(c.applicableCategoryIds ?? [])],
      isActive: c.isActive,
    });
    setModalOpen(true);
  }

  function buildBody(): Record<string, unknown> {
    return {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      discountType: form.discountType,
      tierUnit: form.tierUnit,
      packetTiers: form.packetTiers,
      applicableProductIds: form.applicableProductIds,
      applicableCategoryIds: form.applicableCategoryIds,
      isActive: form.isActive,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = buildBody();
      const url = editingId ? `/api/admin/coupons/${editingId}` : "/api/admin/coupons";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this coupon?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleToggleActive(coupon: AdminCoupon) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/${coupon._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    }
  }

  function updateTier(i: number, patch: Partial<CouponPacketTier>) {
    setForm((f) => {
      const next = f.packetTiers.map((row, j) => (j === i ? { ...row, ...patch } : row));
      return { ...f, packetTiers: next };
    });
  }

  function addTier() {
    setForm((f) => ({
      ...f,
      packetTiers: [...f.packetTiers, { minPackets: 0, value: f.discountType === "percentage" ? 0 : 0 }],
    }));
  }

  function removeTier(i: number) {
    setForm((f) => ({
      ...f,
      packetTiers: f.packetTiers.filter((_, j) => j !== i),
    }));
  }

  const categoryRows = useMemo(
    () => filteredCategories.map((c) => ({ id: c.id, primary: c.name })),
    [filteredCategories]
  );

  const productRows = useMemo(
    () =>
      filteredProducts.map((p) => ({
        id: p.id,
        primary: p.sku ? `${p.sku} — ${p.name}` : p.name,
        secondary: p.categoryName || undefined,
      })),
    [filteredProducts]
  );

  return (
    <div>
      {error ? (
        <div className="admin-banner err" role="alert">
          {error}
        </div>
      ) : null}

      <div className="admin-toolbar">
        {list.length < 5 ? (
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={openCreate}
          >
            New coupon
          </button>
        ) : null}
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </button>
        <span className="muted" style={{ fontSize: "0.875rem" }}>
          {list.length} / 5 coupons
        </span>
      </div>

      <p className="muted" style={{ maxWidth: "48rem", marginBottom: "1rem" }}>
        Tier basis: <strong>packets</strong> uses total eligible packets (carton/bag list units convert to packets).{" "}
        <strong>Outer (cartons & bags)</strong> counts master bags as bags and packet lines as cartons (or
        master-bag equivalents from packaging). Limit scope with categories and/or products; leave both empty for all
        products.
      </p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--nowrap">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Tiers</th>
                <th>Unit</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c._id}>
                  <td>
                    <strong>{c.code}</strong>
                  </td>
                  <td>{c.name}</td>
                  <td>
                    <span className="muted">{c.discountType}</span>
                  </td>
                  <td>{c.packetTiers?.length ?? 0}</td>
                  <td>{c.tierUnit === "outer" ? "outer" : "packets"}</td>
                  <td>{c.isActive ? "Yes" : "No"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className={`admin-btn ${c.isActive ? "admin-btn-ghost" : "admin-btn-primary"}`}
                      style={{ marginRight: 6 }}
                      onClick={() => void handleToggleActive(c)}
                    >
                      {c.isActive ? "Turn Off" : "Turn On"}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() => openEdit(c)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 ? <p className="muted" style={{ padding: "1rem" }}>No coupons yet.</p> : null}
        </div>
      )}

      {modalOpen ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setModalOpen(false);
          }}
        >
          <div className="admin-modal wide admin-coupon-modal" role="dialog" aria-labelledby="coupon-modal-title">
            <h2 id="coupon-modal-title">{editingId ? "Edit coupon" : "New coupon"}</h2>
            <form className="admin-modal-form admin-coupon-modal-form" onSubmit={(e) => void handleSubmit(e)}>
              {optionsError ? (
                <div className="admin-banner err" role="alert" style={{ marginBottom: "0.75rem" }}>
                  {optionsError}
                </div>
              ) : null}

              <div className="admin-form-section">
                <h3 className="admin-form-section-title">Coupon details</h3>
                <div>
                  <div className="admin-field">
                    <label htmlFor="cp-code">Code *</label>
                    <input
                      id="cp-code"
                      className="admin-input"
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="admin-field">
                    <label htmlFor="cp-name">Name *</label>
                    <input
                      id="cp-name"
                      className="admin-input"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="admin-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="cp-desc">Description</label>
                  <textarea
                    id="cp-desc"
                    className="admin-input"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    placeholder="e.g. 7% – 15 cartons & bags (explain in plain language)"
                  />
                </div>
              </div>

              <div className="admin-form-section">
                <h3 className="admin-form-section-title">Discount settings</h3>
                <div className="admin-field-row">
                  <div className="admin-field">
                    <label htmlFor="cp-dtype">Discount type *</label>
                    <select
                      id="cp-dtype"
                      className="admin-input admin-select admin-select-native"
                      value={form.discountType}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, discountType: e.target.value as AdminCoupon["discountType"] }))
                      }
                    >
                      <option value="percentage">Percent discount</option>
                      <option value="flat">Flat discount (INR)</option>
                    </select>
                  </div>
                  <div className="admin-field" style={{ marginBottom: 0 }}>
                    <label htmlFor="cp-tier-unit">Tier unit *</label>
                    <select
                      id="cp-tier-unit"
                      className="admin-input admin-select admin-select-native"
                      value={form.tierUnit ?? "packets"}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          tierUnit: e.target.value as AdminCoupon["tierUnit"],
                        }))
                      }
                    >
                      <option value="packets">Packets</option>
                      <option value="outer">Cartons + bags</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="admin-form-section">
                <label>{form.tierUnit === "outer" ? "Tier thresholds *" : "Packet tiers *"}</label>
                <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
                  {form.tierUnit === "outer"
                    ? "For each row: minimum total outer units (cartons + master bags on eligible lines), then discount value (% or ₹). Column is still named minPackets in the API."
                    : "For each row: minimum eligible packets in the cart, then discount value (% or ₹)."}
                </p>
                <table className="admin-table admin-coupon-tier-table" style={{ marginBottom: 8 }}>
                  <thead>
                    <tr>
                      <th>{form.tierUnit === "outer" ? "Min outer units" : "Min packets"}</th>
                      <th>{form.discountType === "percentage" ? "Percent off" : "INR off"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.packetTiers.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            type="number"
                            className="admin-input"
                            min={0}
                            step={1}
                            value={row.minPackets}
                            onChange={(e) => updateTier(i, { minPackets: Number(e.target.value) })}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="admin-input"
                            min={0}
                            max={form.discountType === "percentage" ? 100 : undefined}
                            step={form.discountType === "percentage" ? 0.01 : 1}
                            value={row.value}
                            onChange={(e) => updateTier(i, { value: Number(e.target.value) })}
                            required
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-form-section">
                <h3 className="admin-form-section-title">Applicability</h3>
                <div className="admin-field-row admin-coupon-scope-row">
                  <MultiCheckboxBlock
                    title="Applicable categories"
                    idPrefix="cp-cat"
                    hint="Leave empty for no category restriction. When you select one or more categories, the product list below is limited to products in those categories only."
                    search={categorySearch}
                    onSearchChange={setCategorySearch}
                    loading={optionsLoading}
                    emptyMessage="No categories match the filter."
                    options={categoryRows}
                    selectedIds={form.applicableCategoryIds}
                    onToggle={(id, checked) =>
                      setForm((f) => ({ ...f, applicableCategoryIds: toggleId(f.applicableCategoryIds, id, checked) }))
                    }
                    onClear={() => setForm((f) => ({ ...f, applicableCategoryIds: [] }))}
                  />
                  <MultiCheckboxBlock
                    title="Applicable products"
                    idPrefix="cp-prod"
                    hint={
                      form.applicableCategoryIds.length > 0
                        ? "Only products belonging to the categories selected above are listed. Leave none checked to apply the coupon to all products in those categories, or pick specific SKUs."
                        : "Select categories above to narrow this list. With no categories selected, all products are shown. A cart line matches if it belongs to a selected category or a selected product (OR)."
                    }
                    search={productSearch}
                    onSearchChange={setProductSearch}
                    loading={optionsLoading}
                    emptyMessage={
                      form.applicableCategoryIds.length > 0
                        ? "No products in the selected categories match the filter."
                        : "No products match the filter."
                    }
                    options={productRows}
                    selectedIds={form.applicableProductIds}
                    onToggle={(id, checked) =>
                      setForm((f) => ({ ...f, applicableProductIds: toggleId(f.applicableProductIds, id, checked) }))
                    }
                    onSelectAll={(ids) =>
                      setForm((f) => ({
                        ...f,
                        applicableProductIds: [...new Set([...f.applicableProductIds, ...ids])],
                      }))
                    }
                    onClear={() => setForm((f) => ({ ...f, applicableProductIds: [] }))}
                  />
                </div>
              </div>

              <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.8rem" }}>
                Coupon scope: if both lists are empty, all products qualify. The product picker is filtered by the
                categories you tick above. If you select categories only, every product in those categories qualifies. If
                you also select specific products, a line matches if it is in a selected category or in the product list
                (OR).
              </p>

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

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
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
