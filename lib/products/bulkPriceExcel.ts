import mongoose from "mongoose";
import * as XLSX from "xlsx";

/** 18% GST — matches storefront pricing math elsewhere in the app. */
export const GST_MULTIPLIER = 1.18;

export const BULK_PRICE_SHEET_NAME = "Product Prices";

export const BULK_PRICE_COLUMNS = [
  "product_id",
  "sku",
  "name",
  "category",
  "price",
  "basic_price",
] as const;

export type BulkPriceExportRow = {
  product_id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  basic_price: number;
};

export type ParsedBulkPriceUpdate = {
  productId: string;
  basicPrice: number;
  priceWithGst: number;
  rowNumber: number;
};

export type BulkPriceRowError = {
  row: number;
  message: string;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function cellString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parsePriceNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
  }
  const cleaned = String(value).replace(/[,₹\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function resolveProductId(row: Record<string, unknown>): string {
  const candidates = [
    row.product_id,
    row._id,
    row.id,
    row.productid,
    row.sku_id,
  ];
  for (const c of candidates) {
    const s = cellString(c);
    if (s) return s;
  }
  return "";
}

function derivePricingFromRow(row: Record<string, unknown>): {
  basicPrice: number;
  priceWithGst: number;
} | null {
  const priceWithGstRaw = parsePriceNumber(
    row.price ?? row.price_with_gst ?? row.pricewithgst ?? row.price_incl_gst
  );
  const basicPriceRaw = parsePriceNumber(
    row.basic_price ?? row.basicprice ?? row.price_ex_gst ?? row.ex_gst_price
  );

  if (priceWithGstRaw != null && basicPriceRaw != null) {
    return {
      priceWithGst: roundMoney(priceWithGstRaw),
      basicPrice: roundMoney(basicPriceRaw),
    };
  }
  if (priceWithGstRaw != null) {
    return {
      priceWithGst: roundMoney(priceWithGstRaw),
      basicPrice: roundMoney(priceWithGstRaw / GST_MULTIPLIER),
    };
  }
  if (basicPriceRaw != null) {
    return {
      basicPrice: roundMoney(basicPriceRaw),
      priceWithGst: roundMoney(basicPriceRaw * GST_MULTIPLIER),
    };
  }
  return null;
}

export function buildBulkPriceWorkbook(rows: BulkPriceExportRow[]): XLSX.WorkBook {
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: [...BULK_PRICE_COLUMNS],
  });
  sheet["!cols"] = [
    { wch: 26 },
    { wch: 16 },
    { wch: 36 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, BULK_PRICE_SHEET_NAME);
  return wb;
}

export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseBulkPriceWorkbook(buffer: Buffer): {
  updates: ParsedBulkPriceUpdate[];
  errors: BulkPriceRowError[];
  skippedRows: number;
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return {
      updates: [],
      errors: [{ row: 0, message: "Workbook has no sheets" }],
      skippedRows: 0,
    };
  }

  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (matrix.length === 0) {
    return {
      updates: [],
      errors: [{ row: 0, message: "Sheet is empty" }],
      skippedRows: 0,
    };
  }

  const headerRow = matrix[0] ?? [];
  const headerKeys = headerRow.map((cell) => normalizeHeader(cell));

  const updatesById = new Map<string, ParsedBulkPriceUpdate>();
  const errors: BulkPriceRowError[] = [];
  let skippedRows = 0;

  for (let i = 1; i < matrix.length; i++) {
    const rowNumber = i + 1;
    const rawRow = matrix[i] ?? [];
    const row: Record<string, unknown> = {};
    let hasContent = false;

    for (let c = 0; c < headerKeys.length; c++) {
      const key = headerKeys[c];
      if (!key) continue;
      const value = rawRow[c];
      if (value !== "" && value != null) hasContent = true;
      row[key] = value;
    }

    if (!hasContent) {
      skippedRows += 1;
      continue;
    }

    const productId = resolveProductId(row);
    if (!productId) {
      errors.push({ row: rowNumber, message: "Missing product_id" });
      continue;
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      errors.push({ row: rowNumber, message: `Invalid product_id: ${productId}` });
      continue;
    }

    const pricing = derivePricingFromRow(row);
    if (!pricing) {
      errors.push({ row: rowNumber, message: "Missing or invalid price / basic_price" });
      continue;
    }

    updatesById.set(productId, {
      productId,
      basicPrice: pricing.basicPrice,
      priceWithGst: pricing.priceWithGst,
      rowNumber,
    });
  }

  return {
    updates: [...updatesById.values()],
    errors,
    skippedRows,
  };
}
