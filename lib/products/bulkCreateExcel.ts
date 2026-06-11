import * as XLSX from "xlsx";
import { derivePricingFromExcelRow } from "@/lib/products/bulkPriceExcel";

export const BULK_CREATE_SHEET_NAME = "New Products";
export const BULK_CREATE_CATEGORIES_SHEET_NAME = "Categories";

export const BULK_CREATE_COLUMNS = [
  "name",
  "brand",
  "category",
  "basic_price",
  "price",
] as const;

export type BulkCreateTemplateRow = {
  name: string;
  brand: string;
  category: string;
  basic_price: number | "";
  price: number | "";
};

export type ParsedBulkCreateRow = {
  name: string;
  brand: string;
  priceWithGst: number;
  basicPrice: number;
  /** Raw category cell — matched by name (preferred) or slug */
  category: string;
  rowNumber: number;
};

export type BulkCreateRowError = {
  row: number;
  message: string;
};

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

function resolveName(row: Record<string, unknown>): string {
  return cellString(row.name ?? row.product_name ?? row.productname);
}

function resolveBrand(row: Record<string, unknown>): string {
  return cellString(row.brand ?? row.brand_name ?? row.brandname);
}

function resolveCategory(row: Record<string, unknown>): string {
  return cellString(
    row.category ?? row.category_name ?? row.categoryname ?? row.category_slug
  );
}

function isExampleTemplateRow(
  name: string,
  brand: string,
  basicPrice: number,
  priceWithGst: number
): boolean {
  return (
    name.toLowerCase() === "example product name" &&
    brand.toLowerCase() === "hitech square" &&
    basicPrice === 100 &&
    priceWithGst === 118
  );
}

export function buildBulkCreateTemplateWorkbook(
  exampleCategoryName = "",
  categoryNames: string[] = []
): XLSX.WorkBook {
  const rows: BulkCreateTemplateRow[] = [
    {
      name: "Example Product Name",
      brand: "Hitech Square",
      category: exampleCategoryName,
      basic_price: 100,
      price: 118,
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...BULK_CREATE_COLUMNS] });
  sheet["!cols"] = [{ wch: 36 }, { wch: 20 }, { wch: 28 }, { wch: 12 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, BULK_CREATE_SHEET_NAME);

  if (categoryNames.length > 0) {
    const refRows = categoryNames.map((name) => ({ category: name }));
    const refSheet = XLSX.utils.json_to_sheet(refRows, { header: ["category"] });
    refSheet["!cols"] = [{ wch: 32 }];
    XLSX.utils.book_append_sheet(wb, refSheet, BULK_CREATE_CATEGORIES_SHEET_NAME);
  }

  return wb;
}

export function bulkCreateWorkbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseBulkCreateWorkbook(buffer: Buffer): {
  rows: ParsedBulkCreateRow[];
  errors: BulkCreateRowError[];
  skippedRows: number;
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((n) => normalizeHeader(n) === normalizeHeader(BULK_CREATE_SHEET_NAME)) ??
    wb.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
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
      rows: [],
      errors: [{ row: 0, message: "Sheet is empty" }],
      skippedRows: 0,
    };
  }

  const headerRow = matrix[0] ?? [];
  const headerKeys = headerRow.map((cell) => normalizeHeader(cell));

  const rows: ParsedBulkCreateRow[] = [];
  const errors: BulkCreateRowError[] = [];
  const seenKeys = new Set<string>();
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

    const name = resolveName(row);
    if (!name) {
      errors.push({ row: rowNumber, message: "Missing name" });
      continue;
    }

    const brand = resolveBrand(row);
    if (!brand) {
      errors.push({ row: rowNumber, message: "Missing brand" });
      continue;
    }

    const pricing = derivePricingFromExcelRow(row);
    if (!pricing) {
      errors.push({
        row: rowNumber,
        message: "Missing or invalid price / basic_price (provide at least one)",
      });
      continue;
    }

    const category = resolveCategory(row);

    const dedupeKey = `${name.toLowerCase()}::${brand.toLowerCase()}`;
    if (seenKeys.has(dedupeKey)) {
      errors.push({ row: rowNumber, message: "Duplicate name + brand in this file" });
      continue;
    }
    seenKeys.add(dedupeKey);

    if (isExampleTemplateRow(name, brand, pricing.basicPrice, pricing.priceWithGst)) {
      skippedRows += 1;
      continue;
    }

    rows.push({
      name,
      brand,
      priceWithGst: pricing.priceWithGst,
      basicPrice: pricing.basicPrice,
      category,
      rowNumber,
    });
  }

  return { rows, errors, skippedRows };
}
