"use client";

import "react-quill-new/dist/quill.snow.css";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState } from "react";
import { extractUploadResult } from "@/lib/media-upload-result";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

function getErrorMessage(json: unknown, fallback: string) {
  if (json && typeof json === "object" && "message" in json) {
    const message = (json as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function isEditorContentEmpty(html: string) {
  const plain = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
  return plain.length === 0;
}

export default function CreateBlogPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publishDate, setPublishDate] = useState(today);
  const [image, setImage] = useState("");
  const [content, setContent] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const quillModules = useMemo(
    () => ({
      toolbar: [["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], ["link"]],
    }),
    []
  );

  async function onUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Reuse existing media route kind until a dedicated "blog" kind is added.
      fd.append("kind", "product");
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Image upload failed"));
      }
      const { url } = extractUploadResult(json);
      setImage(url);
      setSuccess("Image uploaded successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      setPublishing(true);
      if (!title.trim()) {
        setError("Title is required");
        return;
      }
      if (!image.trim()) {
        alert("Please upload an image first");
        return;
      }
      if (isEditorContentEmpty(content)) {
        setError("Content is required");
        return;
      }

      const formData = {
        title: title.trim(),
        author: author.trim(),
        image: image.trim(),
        content,
        createdAt: publishDate ? new Date(`${publishDate}T00:00:00.000Z`).toISOString() : undefined,
      };
      console.log("Submitting blog...", formData);

      const res = await fetch("/api/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Failed to publish blog"));
      }
      setSuccess("Blog published successfully. Redirecting...");
      router.push("/admin/blogs");
    } catch (error) {
      console.error("Upload failed:", error);
      setError(error instanceof Error ? error.message : "Failed to publish blog");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Create blog</h1>
      <p className="muted" style={{ maxWidth: "40rem" }}>
        Draft and publish a blog post with Cloudinary image and rich content.
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

      <form onSubmit={(e) => void handleSubmit(e)} className="admin-form-section" style={{ maxWidth: "52rem" }}>
        <div className="admin-field">
          <label htmlFor="blog-title">Title</label>
          <input
            id="blog-title"
            className="admin-input"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter blog title"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="blog-author">Author</label>
          <input
            id="blog-author"
            className="admin-input"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Enter author name"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="blog-date">Date</label>
          <input
            id="blog-date"
            className="admin-input"
            type="date"
            value={publishDate}
            onChange={(e) => setPublishDate(e.target.value)}
          />
        </div>

        <div className="admin-field admin-media-field">
          <span className="admin-media-label">Blog image</span>
          <div className="admin-media-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="admin-sr-only"
              onChange={(e) => void onUploadImage(e)}
              disabled={uploadingImage}
            />
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingImage}
            >
              {uploadingImage ? "Uploading…" : "Add image"}
            </button>
            {image ? (
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setImage("")}>
                Clear image
              </button>
            ) : null}
          </div>
          {image ? (
            <div className="admin-media-preview">
              <img src={image} alt="Blog preview" width={240} height={140} style={{ objectFit: "contain" }} />
            </div>
          ) : null}
        </div>

        <div className="admin-field">
          <label>Content</label>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
            <ReactQuill
              theme="snow"
              value={content}
              onChange={(html) => setContent(html)}
              modules={quillModules}
              placeholder="Write your blog content here..."
            />
          </div>
        </div>

        <div className="admin-modal-actions" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => router.push("/admin/blogs")}
            disabled={publishing}
          >
            Cancel
          </button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={publishing}>
            {publishing ? "Publishing..." : "Publish blog"}
          </button>
        </div>
      </form>
    </div>
  );
}
