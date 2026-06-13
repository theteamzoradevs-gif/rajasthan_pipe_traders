"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Download, FilePlus2, Upload } from "lucide-react";

type ImportResult = {
  requested: number;
  createdCount: number;
  failedCount: number;
  skippedRows: number;
  rowsUsingDefaultCategory: number;
  rowErrors: { row: number; message: string }[];
};

function parseFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return "bulk-product-import-template.xlsx";
  const match = /filename="([^"]+)"/i.exec(contentDisposition);
  return match?.[1] ?? "bulk-product-import-template.xlsx";
}

export default function BulkProductCreatePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const acceptExcel = useCallback((file: File | null | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      setError("Please choose an Excel file (.xlsx or .xls).");
      setSelectedFile(null);
      return;
    }
    setError(null);
    setResult(null);
    setSelectedFile(file);
  }, []);

  const handleDownloadTemplate = useCallback(async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products/bulk-create-template");
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "Template download failed");
      }
      const blob = await res.blob();
      const filename = parseFilename(res.headers.get("Content-Disposition"));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Template download failed");
    } finally {
      setDownloading(false);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      setError("Select an Excel file before importing.");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/admin/products/bulk-create", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as {
        message?: string;
        data?: ImportResult;
        errors?: { row: number; message: string }[];
      };

      if (!res.ok) {
        const rowErrors = json.errors ?? [];
        const detail =
          rowErrors.length > 0
            ? `${json.message ?? "Import failed"} (${rowErrors.length} row error(s))`
            : (json.message ?? "Import failed");
        setError(detail);
        if (rowErrors.length > 0) {
          setResult({
            requested: 0,
            createdCount: 0,
            failedCount: rowErrors.length,
            skippedRows: 0,
            rowsUsingDefaultCategory: 0,
            rowErrors,
          });
        }
        return;
      }

      setResult(json.data ?? null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setUploading(false);
    }
  }, [selectedFile]);

  return (
    <div className="admin-bulk-import">
      <header className="admin-bulk-import-header">
        <div>
          <p className="admin-dashboard-kicker">Products</p>
          <h1 className="admin-dashboard-title">Bulk product import</h1>
          <p className="admin-dashboard-lead">
            Create new catalog products from Excel with <strong>name</strong>, <strong>brand</strong>,{" "}
            <strong>basic_price</strong> (ex-GST), <strong>price</strong> (incl. GST), and optional{" "}
            <strong>category</strong> (category name). Other details can be completed later in the
            product editor.
          </p>
        </div>
        <Link href="/admin/products" className="admin-btn admin-btn-ghost">
          ← Back to products
        </Link>
      </header>

      {error ? (
        <div className="admin-banner err" role="alert">
          {error}
        </div>
      ) : null}

      {result && result.createdCount > 0 ? (
        <div className="admin-banner ok" role="status">
          Created {result.createdCount} of {result.requested} product(s).
          {result.failedCount > 0 ? ` ${result.failedCount} row(s) failed.` : ""}
          {result.skippedRows > 0 ? ` Skipped ${result.skippedRows} empty/example row(s).` : ""}
          {result.rowsUsingDefaultCategory > 0
            ? ` ${result.rowsUsingDefaultCategory} row(s) used the default category (category column was blank).`
            : ""}{" "}
          <Link href="/admin/products">View product list</Link> — new imports appear at the end of
          the list and on the storefront category page.
        </div>
      ) : null}

      <div className="admin-bulk-import-grid">
        <section className="admin-form-section admin-bulk-import-card">
          <h2 className="admin-form-section-title">
            <FilePlus2 size={18} aria-hidden />
            1. Download import template
          </h2>
          <p className="admin-bulk-import-desc">
            Sheet <strong>New Products</strong> columns: <code>name</code>, <code>brand</code>,{" "}
            <code>category</code> (exact name — see <strong>Categories</strong> sheet),{" "}
            <code>basic_price</code> (ex-GST), and <code>price</code> (incl. GST). Fill at least
            one price column; the other is calculated at 18% GST. Delete the example row before
            uploading.
          </p>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => void handleDownloadTemplate()}
            disabled={downloading || uploading}
          >
            <Download size={16} aria-hidden style={{ marginRight: "0.4rem" }} />
            {downloading ? "Preparing template…" : "Download template"}
          </button>
        </section>

        <section className="admin-form-section admin-bulk-import-card">
          <h2 className="admin-form-section-title">
            <Upload size={18} aria-hidden />
            2. Upload &amp; create products
          </h2>
          <p className="admin-bulk-import-desc">
            New products appear on the storefront with name, brand, and both prices. Leave{" "}
            <code>category</code> blank to use your default category. Images and descriptions can be
            added in admin afterward.
          </p>

          <div
            className={`admin-bulk-import-dropzone${dragActive ? " is-dragover" : ""}${selectedFile ? " has-file" : ""}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              acceptExcel(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Choose Excel file for bulk product import"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="admin-bulk-import-file-input"
              onChange={(e) => acceptExcel(e.target.files?.[0])}
            />
            {selectedFile ? (
              <>
                <strong>{selectedFile.name}</strong>
                <span className="muted">{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </>
            ) : (
              <>
                <strong>Drag &amp; drop Excel here</strong>
                <span className="muted">or click to browse (.xlsx)</span>
              </>
            )}
          </div>

          <div className="admin-bulk-import-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => void handleUpload()}
              disabled={!selectedFile || uploading || downloading}
            >
              {uploading ? "Creating products…" : "Upload & create products"}
            </button>
            {selectedFile ? (
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => {
                  setSelectedFile(null);
                  setResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={uploading}
              >
                Clear file
              </button>
            ) : null}
          </div>
        </section>
      </div>

      {result && result.rowErrors.length > 0 ? (
        <section className="admin-form-section admin-bulk-import-errors">
          <h2 className="admin-form-section-title">Row warnings</h2>
          <ul className="admin-bulk-import-error-list">
            {result.rowErrors.map((item) => (
              <li key={`${item.row}-${item.message}`}>
                Row {item.row}: {item.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
