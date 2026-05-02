"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type BlogRow = {
  _id: string;
  title: string;
  author?: string;
  image?: string;
  content?: string;
  createdAt?: string;
};

const emptyForm = {
  title: "",
  author: "",
  createdAt: "",
  image: "",
  content: "",
};

function getMessage(json: unknown, fallback: string) {
  if (json && typeof json === "object" && "message" in json) {
    const msg = (json as { message: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState<BlogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasBlogs = useMemo(() => blogs.length > 0, [blogs]);

  const loadBlogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/blogs", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getMessage(json, "Failed to fetch blogs"));
      }
      const data = json && typeof json === "object" && "data" in json ? (json as { data: unknown }).data : [];
      setBlogs(Array.isArray(data) ? (data as BlogRow[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch blogs");
      setBlogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBlogs();
  }, [loadBlogs]);

  function openEdit(blog: BlogRow) {
    setEditingId(blog._id);
    setForm({
      title: blog.title ?? "",
      author: blog.author ?? "",
      createdAt: blog.createdAt ? new Date(blog.createdAt).toISOString().slice(0, 10) : "",
      image: blog.image ?? "",
      content: blog.content ?? "",
    });
    setError(null);
    setSuccess(null);
    setModalOpen(true);
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        title: form.title.trim(),
        author: form.author.trim(),
        createdAt: form.createdAt ? new Date(`${form.createdAt}T00:00:00.000Z`).toISOString() : undefined,
        image: form.image.trim(),
        content: form.content,
      };
      const res = await fetch(`/api/blogs/${encodeURIComponent(editingId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getMessage(json, "Failed to update blog"));
      }
      setSuccess("Blog updated successfully.");
      setModalOpen(false);
      setEditingId(null);
      await loadBlogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update blog");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(blogId: string) {
    if (!confirm("Delete this blog post?")) return;
    setDeletingId(blogId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/blogs/${encodeURIComponent(blogId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getMessage(json, "Failed to delete blog"));
      }
      setSuccess("Blog deleted successfully.");
      setBlogs((prev) => prev.filter((b) => b._id !== blogId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete blog");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Blogs</h1>
      <p className="muted" style={{ maxWidth: "40rem" }}>
        Manage company news, industry updates, and blog posts.
      </p>

      {error ? (
        <div className="admin-banner err" role="alert">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="admin-banner" role="status">
          {success}
        </div>
      ) : null}

      <div className="admin-toolbar">
        <Link href="/admin/blogs/create" className="admin-btn admin-btn-primary">
          Create new blog
        </Link>
        <button type="button" className="admin-btn admin-btn-ghost" onClick={() => void loadBlogs()} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : hasBlogs ? (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--nowrap">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {blogs.map((blog) => (
                <tr key={blog._id}>
                  <td>{blog.title || "-"}</td>
                  <td>{blog.author?.trim() || "-"}</td>
                  <td>{formatDate(blog.createdAt)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      style={{ marginRight: 6 }}
                      onClick={() => openEdit(blog)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(blog._id)}
                      disabled={deletingId === blog._id}
                      className="admin-btn admin-btn-danger"
                    >
                      {deletingId === blog._id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <p className="muted" style={{ padding: "1rem" }}>
            No blogs found. Create your first blog post to get started.
          </p>
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
          <div className="admin-modal wide" role="dialog" aria-labelledby="blog-modal-title">
            <h2 id="blog-modal-title">Edit blog</h2>
            <form onSubmit={(e) => void onSaveEdit(e)}>
              <div className="admin-field">
                <label htmlFor="blog-edit-title">Title</label>
                <input
                  id="blog-edit-title"
                  className="admin-input"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="admin-field">
                <label htmlFor="blog-edit-author">Author</label>
                <input
                  id="blog-edit-author"
                  className="admin-input"
                  value={form.author}
                  onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                />
              </div>
              <div className="admin-field">
                <label htmlFor="blog-edit-date">Date</label>
                <input
                  id="blog-edit-date"
                  type="date"
                  className="admin-input"
                  value={form.createdAt}
                  onChange={(e) => setForm((f) => ({ ...f, createdAt: e.target.value }))}
                />
              </div>
              <div className="admin-field">
                <label htmlFor="blog-edit-image">Image URL</label>
                <input
                  id="blog-edit-image"
                  className="admin-input"
                  value={form.image}
                  onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                />
              </div>
              <div className="admin-field">
                <label htmlFor="blog-edit-content">Content (HTML)</label>
                <textarea
                  id="blog-edit-content"
                  className="admin-input"
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={10}
                />
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
