"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";

type UploadResult = {
  requested: number;
  matchedCount: number;
  modifiedCount: number;
  skippedRows: number;
  notFoundCount: number;
  rowErrors: { row: number; message: string }[];
};

function parseFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return "product-prices.xlsx";
  const match = /filename="([^"]+)"/i.exec(contentDisposition);
  return match?.[1] ?? "product-prices.xlsx";
}

export default function BulkPriceUpdatePanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

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

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products/export-prices");
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "Export failed");
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
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      setError("Select an Excel file before uploading.");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/admin/products/bulk-price-update", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as {
        message?: string;
        data?: UploadResult;
        errors?: { row: number; message: string }[];
      };

      if (!res.ok) {
        const rowErrors = json.errors ?? [];
        const detail =
          rowErrors.length > 0
            ? `${json.message ?? "Upload failed"} (${rowErrors.length} row error(s))`
            : (json.message ?? "Upload failed");
        setError(detail);
        if (rowErrors.length > 0) {
          setResult({
            requested: 0,
            matchedCount: 0,
            modifiedCount: 0,
            skippedRows: 0,
            notFoundCount: 0,
            rowErrors,
          });
        }
        return;
      }

      setResult(json.data ?? null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [selectedFile]);

  return (
    <div className="admin-bulk-price">
      <header className="admin-bulk-price-header">
        <div>
          <p className="admin-dashboard-kicker">Products</p>
          <h1 className="admin-dashboard-title">Bulk price update</h1>
          <p className="admin-dashboard-lead">
            Export the current catalog to Excel, edit the <strong>price</strong> column (GST-inclusive),
            then upload the file to apply changes in one batch via MongoDB <code>bulkWrite</code>.
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

      {result ? (
        <div className="admin-banner ok" role="status">
          Updated {result.modifiedCount} of {result.requested} product(s).
          {result.notFoundCount > 0 ? ` ${result.notFoundCount} ID(s) not found.` : ""}
          {result.skippedRows > 0 ? ` Skipped ${result.skippedRows} empty row(s).` : ""}
        </div>
      ) : null}

      <div className="admin-bulk-price-grid">
        <section className="admin-form-section admin-bulk-price-card">
          <h2 className="admin-form-section-title">
            <FileSpreadsheet size={18} aria-hidden />
            1. Export current prices
          </h2>
          <p className="admin-bulk-price-desc">
            Downloads an <code>.xlsx</code> file with columns:{" "}
            <code>product_id</code>, <code>sku</code>, <code>name</code>, <code>category</code>,{" "}
            <code>price</code> (incl. GST), and <code>basic_price</code> (ex-GST reference).
          </p>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => void handleExport()}
            disabled={exporting || uploading}
          >
            <Download size={16} aria-hidden style={{ marginRight: "0.4rem" }} />
            {exporting ? "Preparing export…" : "Export current prices"}
          </button>
        </section>

        <section className="admin-form-section admin-bulk-price-card">
          <h2 className="admin-form-section-title">
            <Upload size={18} aria-hidden />
            2. Upload &amp; apply updates
          </h2>
          <p className="admin-bulk-price-desc">
            Keep <code>product_id</code> unchanged. Edit <code>price</code> (or <code>basic_price</code>);
            the other field is recalculated at 18% GST when omitted.
          </p>

          <div
            className={`admin-bulk-price-dropzone${dragActive ? " is-dragover" : ""}${selectedFile ? " has-file" : ""}`}
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
            aria-label="Choose Excel file for bulk price update"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="admin-bulk-price-file-input"
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

          <div className="admin-bulk-price-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => void handleUpload()}
              disabled={!selectedFile || uploading || exporting}
            >
              {uploading ? "Applying updates…" : "Upload & apply updates"}
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
        <section className="admin-form-section admin-bulk-price-errors">
          <h2 className="admin-form-section-title">Row warnings</h2>
          <ul className="admin-bulk-price-error-list">
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
