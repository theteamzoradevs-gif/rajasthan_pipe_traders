"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MediaImageField } from "../components/MediaImageField";
import AdminCategorySearchBar from "../components/AdminCategorySearchBar";
import type { AdminCategory } from "../types";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { SortableCategoryRow } from "./SortableCategoryRow";
import { CSS } from "@dnd-kit/utilities";

const CATEGORY_PAGE_SIZE = 20;

function slugFromName(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  image: "",
  parentId: "" as string,
  sortOrder: 0,
  sourceSectionLabel: "",
  isActive: true,
};

type AdminCategoryProduct = {
  _id: string;
  name: string;
  slug?: string;
  isActive?: boolean;
  isEligibleForCombo?: boolean | null;
  category?: { _id: string; name: string; slug: string } | null;
  productKind?: "sku" | "catalog";
  sortOrder?: number;
  categorySortOrder?: number;
};

function SortableRearrangeRow({
  product,
  index,
}: {
  product: AdminCategoryProduct;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? "var(--admin-bg-hover, #f8fafc)" : undefined,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td {...attributes} {...listeners} style={{ cursor: "grab", width: "40px" }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="muted"
        >
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </td>
      <td>{index + 1}</td>
      <td>
        <div style={{ fontWeight: 500 }}>{product.name}</div>
        <div className="muted" style={{ fontSize: "0.75rem" }}>
          {product.productKind === "sku" ? "SKU" : "Catalog"}
        </div>
      </td>
      <td>
        <span className="muted">{product.slug}</span>
      </td>
      <td>{product.categorySortOrder ?? 0}</td>
    </tr>
  );
}

export default function AdminCategoriesPage() {
  const [list, setList] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sortConflict, setSortConflict] = useState<{
    _id: string;
    name: string;
    sortOrder: number;
  } | null>(null);
  const [page, setPage] = useState(0);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [rearrangeModalOpen, setRearrangeModalOpen] = useState(false);
  const [rearrangeCategory, setRearrangeCategory] = useState<AdminCategory | null>(null);
  const [rearrangeProducts, setRearrangeProducts] = useState<AdminCategoryProduct[]>([]);
  const [rearrangeLoading, setRearrangeLoading] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories?includeInactive=true", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      setList(json.data as AdminCategory[]);
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

  const total = list.length;
  const pageSlice = useMemo(
    () => list.slice(page * CATEGORY_PAGE_SIZE, page * CATEGORY_PAGE_SIZE + CATEGORY_PAGE_SIZE),
    [list, page],
  );

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(total / CATEGORY_PAGE_SIZE) - 1);
    if (total === 0) setPage(0);
    else if (page > maxPage) setPage(maxPage);
  }, [total, page]);

  const canPrevPage = page > 0;
  const canNextPage = (page + 1) * CATEGORY_PAGE_SIZE < total;
  const activeCategory = activeCategoryId
    ? list.find((category) => category._id === activeCategoryId) ?? null
    : null;

  useEffect(() => {
    if (!activeCategoryId) return;

    let frameId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pointerY: number | null = null;
    const PAGE_TURN_ZONE = 120;
    const PAGE_TURN_DELAY = 250;

    const schedulePageTurn = () => {
      if (timeoutId || pointerY === null) return;

      if (pointerY >= window.innerHeight - PAGE_TURN_ZONE && canNextPage) {
        timeoutId = setTimeout(() => {
          setPage((currentPage) => currentPage + 1);
          timeoutId = null;
          frameId = requestAnimationFrame(schedulePageTurn);
        }, PAGE_TURN_DELAY);
        return;
      }

      if (pointerY <= PAGE_TURN_ZONE && canPrevPage) {
        timeoutId = setTimeout(() => {
          setPage((currentPage) => Math.max(0, currentPage - 1));
          timeoutId = null;
          frameId = requestAnimationFrame(schedulePageTurn);
        }, PAGE_TURN_DELAY);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerY = event.clientY;
      schedulePageTurn();
    };

    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (frameId) cancelAnimationFrame(frameId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeCategoryId, canNextPage, canPrevPage]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSortConflict(null);
    setModalOpen(true);
  }

  function openEdit(c: AdminCategory) {
    setEditingId(c._id);
    setSortConflict(null);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description ?? "",
      image: c.image ?? "",
      parentId: c.parent?._id ?? "",
      sortOrder: c.sortOrder ?? 0,
      sourceSectionLabel: c.sourceSectionLabel ?? "",
      isActive: c.isActive,
    });
    setModalOpen(true);
  }

  async function saveCategory(swapSortOrderWith?: string) {
    setSaving(true);
    setError(null);
    if (!swapSortOrderWith) setSortConflict(null);
    try {
      const parentId = form.parentId.trim() ? form.parentId.trim() : null;
      const derivedSlug = editingId ? form.slug.trim().toLowerCase() : slugFromName(form.name);
      if (!derivedSlug) throw new Error("Name is required to auto-generate slug");

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        slug: derivedSlug,
        description: form.description.trim() || undefined,
        image: form.image.trim() || null,
        sourceSectionLabel: form.sourceSectionLabel.trim() || undefined,
        isActive: form.isActive,
        parent: parentId,
      };
      if (!editingId) {
        body.sortOrder = Number(form.sortOrder) || 0;
      }
      if (swapSortOrderWith && !editingId) {
        body.swapSortOrderWith = swapSortOrderWith;
      }
      const url = editingId ? `/api/admin/categories/${editingId}` : "/api/admin/categories";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        message?: string;
        code?: string;
        conflict?: { _id: string; name: string; sortOrder: number };
      };
      if (!res.ok) {
        const base = json.message || res.statusText;
        if (res.status === 409 && json.code === "SORT_ORDER_CONFLICT" && json.conflict) {
          setSortConflict(json.conflict);
          setError(
            `Sort order ${json.conflict.sortOrder} is already used by “${json.conflict.name}” in this group.`
          );
          return;
        }
        if (res.status === 409 && String(base).toLowerCase().includes("slug")) {
          const s = derivedSlug;
          throw new Error(
            `${base} The slug must be unique. Try a different value (e.g. "${s}-2").`
          );
        }
        throw new Error(base);
      }
      setSortConflict(null);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void saveCategory();
  }

  async function handleSwapSortOrder() {
    if (!sortConflict) return;
    await saveCategory(sortConflict._id);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this category? Products or subcategories may block deletion.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveCategoryId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCategoryId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = list.findIndex((c) => c._id === active.id);
    const newIndex = list.findIndex((c) => c._id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newList = arrayMove(list, oldIndex, newIndex);
    setList(newList);

    try {
      const res = await fetch("/api/admin/categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: newList.map((c: AdminCategory) => c._id) }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to save new order");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reorder failed");
      void load(); // Rollback on failure
    }
  } 

  function handleDragCancel() {
    setActiveCategoryId(null);
  }

  async function openRearrangeProducts(c: AdminCategory) {
    setRearrangeCategory(c);
    setRearrangeModalOpen(true);
    setRearrangeProducts([]);
    setRearrangeLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/products?categorySlug=${encodeURIComponent(c.slug)}&limit=500`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as { data?: AdminCategoryProduct[]; message?: string };
      if (!res.ok) throw new Error(json.message || res.statusText);
      const rows = Array.isArray(json.data) ? json.data : [];
      // Sort by current categorySortOrder for initial display
      const sorted = [...rows].sort((a, b) => (a.categorySortOrder ?? 0) - (b.categorySortOrder ?? 0));
      setRearrangeProducts(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load category products");
      setRearrangeProducts([]);
    } finally {
      setRearrangeLoading(false);
    }
  }

  function handleRearrangeDragStart(event: DragStartEvent) {
    setActiveProductId(String(event.active.id));
  }

  function handleRearrangeDragEnd(event: DragEndEvent) {
    setActiveProductId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rearrangeProducts.findIndex((p) => p._id === active.id);
    const newIndex = rearrangeProducts.findIndex((p) => p._id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    setRearrangeProducts((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  async function saveRearrange() {
    if (!rearrangeCategory) return;
    setSaving(true);
    setError(null);
    try {
      const originalSortOrders = [...rearrangeProducts]
        .map((p) => p.categorySortOrder ?? 0)
        .sort((a, b) => a - b);

      // If ranks are missing (0) or have duplicates, generate a fresh unique sequence [1, 2, 3...]
      // to ensure the manual reordering is actually preserved in the database.
      const rankedOrders = originalSortOrders.filter((o) => o > 0);
      const uniqueRankedCount = new Set(rankedOrders).size;
      const needsFreshSequence = uniqueRankedCount < rearrangeProducts.length;

      const finalOrders = needsFreshSequence
        ? rearrangeProducts.map((_, i) => i + 1)
        : originalSortOrders;

      const updates = rearrangeProducts.map((p, index) => ({
        id: p._id,
        sortOrder: finalOrders[index],
      }));

      const res = await fetch("/api/admin/products/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, field: "categorySortOrder" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to save new order");
      }
      setRearrangeModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error ? (
        <div className="admin-banner err" role="alert">
          {error}
        </div>
      ) : null}

      <div className="admin-toolbar admin-toolbar-with-search">
        <div className="admin-toolbar-left">
          <button type="button" className="admin-btn admin-btn-primary" onClick={openCreate}>
            New category
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </button>
          <span className="muted" style={{ fontSize: "0.875rem" }}>
            {total} category(s) total
          </span>
        </div>
        {!loading ? <AdminCategorySearchBar categories={list} /> : null}
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="admin-table-wrap">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
          >
            <table className="admin-table admin-table--nowrap">
              <thead>
                <tr>
                  <th style={{ width: "40px" }} />
                  <th>S.No</th>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Order</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <SortableContext items={pageSlice.map((c) => c._id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {pageSlice.map((c, index) => (
                    <SortableCategoryRow
                      key={c._id}
                      category={c}
                      index={index}
                      page={page}
                      pageSize={CATEGORY_PAGE_SIZE}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onRearrange={openRearrangeProducts}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
            <DragOverlay>
              {activeCategory ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px minmax(0, 1fr)",
                    gap: 12,
                    alignItems: "center",
                    minWidth: 320,
                    maxWidth: 520,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1px solid rgba(148, 163, 184, 0.4)",
                    background: "#ffffff",
                    boxShadow: "0 18px 38px rgba(15, 23, 42, 0.18)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--admin-muted, #64748b)",
                    }}
                  >
                    #{list.findIndex((category) => category._id === activeCategory._id) + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--admin-text, #0f172a)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {activeCategory.name}
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          {list.length === 0 ? <p className="muted" style={{ padding: "1rem" }}>No categories.</p> : null}
        </div>
      )}

      {!loading && total > 0 ? (
        <div className="admin-pagination">
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            disabled={!canPrevPage || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span>
            Showing {page * CATEGORY_PAGE_SIZE + 1}–{Math.min((page + 1) * CATEGORY_PAGE_SIZE, total)} of{" "}
            {total}
          </span>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            disabled={!canNextPage || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setModalOpen(false);
          }}
        >
          <div className="admin-modal admin-category-modal" role="dialog" aria-labelledby="cat-modal-title">
            <h2 id="cat-modal-title">{editingId ? "Edit category" : "New category"}</h2>
            <form onSubmit={handleSubmit} className="admin-modal-form admin-category-modal-form">
              <div className="admin-form-section">
                <h3 className="admin-form-section-title">Category details</h3>
                <div className="admin-field">
                  <label htmlFor="cat-name">Name</label>
                  <input
                    id="cat-name"
                    className="admin-input"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="admin-field">
                  <label htmlFor="cat-desc">Description</label>
                  <textarea
                    id="cat-desc"
                    className="admin-input"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="admin-form-section">
                <h3 className="admin-form-section-title">Image</h3>
                <MediaImageField
                  label="Category image (Cloudinary)"
                  kind="category"
                  categoryId={editingId ?? undefined}
                  value={form.image}
                  onUrlChange={(url) => setForm((f) => ({ ...f, image: url }))}
                  helpText="Uploads to Cloudinary (folder rpt/category/…). Set CLOUDINARY_URL in .env.local."
                />
              </div>

              <div className="admin-form-section">
                <h3 className="admin-form-section-title">Display settings</h3>
                <div className="admin-field-row">
                  {!editingId ? (
                    <div className="admin-field">
                      <label htmlFor="cat-sort">Sort order</label>
                      <input
                        id="cat-sort"
                        type="number"
                        className="admin-input"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={form.sortOrder}
                        onChange={(e) => {
                          setSortConflict(null);
                          const v = e.target.value;
                          setForm((f) => ({
                            ...f,
                            sortOrder: v === "" ? 0 : Number(v),
                          }));
                        }}
                      />
                      <p className="muted" style={{ marginTop: 6 }}>
                        Lower numbers appear first within the same parent group. If this order is already taken, you can swap after save.
                      </p>
                    </div>
                  ) : null}
                  <div className="admin-field">
                    <label htmlFor="cat-source">Source section label (optional)</label>
                    <input
                      id="cat-source"
                      className="admin-input"
                      value={form.sourceSectionLabel}
                      onChange={(e) => setForm((f) => ({ ...f, sourceSectionLabel: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="admin-field" style={{ marginBottom: 0 }}>
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

              {!editingId && sortConflict ? (
                <div className="admin-banner" role="status" style={{ marginBottom: 12 }}>
                  <p style={{ margin: "0 0 8px" }}>
                    {`“${sortConflict.name}” uses this order. Move it to the end of the list and use ${sortConflict.sortOrder} for this category.`}
                  </p>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    disabled={saving}
                    onClick={() => void handleSwapSortOrder()}
                  >
                    Apply and move other category
                  </button>
                </div>
              ) : null}
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

      {rearrangeModalOpen ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setRearrangeModalOpen(false);
          }}
        >
          <div className="admin-modal wide" role="dialog" aria-labelledby="rearrange-title">
            <h2 id="rearrange-title">Rearrange Products in {rearrangeCategory?.name}</h2>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              Drag the rows to change the display order on the storefront for this category.
            </p>
            {rearrangeLoading ? (
              <p className="muted">Loading products…</p>
            ) : rearrangeProducts.length === 0 ? (
              <p className="muted">No products found in this category.</p>
            ) : (
              <div className="admin-table-wrap" style={{ marginBottom: "1.5rem" }}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleRearrangeDragStart}
                  onDragEnd={handleRearrangeDragEnd}
                  onDragCancel={() => setActiveProductId(null)}
                  modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
                >
                  <table className="admin-table admin-table--nowrap">
                    <thead>
                      <tr>
                        <th style={{ width: "40px" }} />
                        <th>#</th>
                        <th>Name / Type</th>
                        <th>Slug</th>
                        <th>Order</th>
                      </tr>
                    </thead>
                    <SortableContext
                      items={rearrangeProducts.map((p) => p._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <tbody>
                        {rearrangeProducts.map((p, index) => (
                          <SortableRearrangeRow key={p._id} product={p} index={index} />
                        ))}
                      </tbody>
                    </SortableContext>
                  </table>
                  <DragOverlay>
                    {activeProductId ? (
                      <div
                        style={{
                          padding: "12px 16px",
                          background: "#fff",
                          border: "1px solid #ccc",
                          borderRadius: "8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      >
                        {rearrangeProducts.find((p) => p._id === activeProductId)?.name}
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            )}
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setRearrangeModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => void saveRearrange()}
                disabled={saving || rearrangeLoading}
              >
                {saving ? "Saving Order…" : "Save Order"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
