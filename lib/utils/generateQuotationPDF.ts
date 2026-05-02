import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { normalizeOrderMode, pricedPacketCount, type CartOrderMode } from "@/lib/cart/packetLine";

export const RPT_LOGO_PATH = "/logo.jpeg";

const SELLER = {
  name: "RAJASTHAN PIPE TRADERS",
  address:
    "HOUSE NO. C-1, SAFAL SUMEL-10, MH MILLS, NEAR AMBEDKAR HALL, BEHIND KALUPUR RAILWAY STATION, SARASPUR, AHMEDABAD-380018.",
  gst: "GSTIN: 24ABGPL3782K1ZE",
  contact: "9313386488",
  email: "chetan.mutha9@gmail.com",
} as const;

const BANK = {
  accountHolder: "Rajasthan Pipe Traders",
  bankName: "KOTAK MAHINDRA BANK",
  accountNo: "3311963903",
  branchAndIfsc: "Vadaj & KKBK0002590",
} as const;

const DOC_FOOTER_NOTE = "This is a Computer Generated Document";

const GRID_LINE: [number, number, number] = [210, 215, 225];
const GST_INCLUSIVE_DIVISOR = 1.18;

/** White header/footer cells, black text & borders (jsPDF-AutoTable uses fillColor, not fillGray). */
const TABLE_HEAD_FOOT = {
  fillColor: [255, 255, 255] as [number, number, number],
  textColor: [0, 0, 0] as [number, number, number],
  fontStyle: "bold" as const,
  lineColor: [0, 0, 0] as [number, number, number],
  lineWidth: 0.1,
};

export interface QuotationPdfOrderSummary {
  basicTotal?: number;
  gstTotal?: number;
  couponDiscount?: number;
  finalTotal?: number;
  [key: string]: unknown;
}

export interface QuotationPdfCartLine {
  productName?: string;
  brand?: string;
  size?: string;
  category?: string;
  quantity?: number;
  orderMode?: CartOrderMode;
  qtyPerBag?: number;
  pcsPerPacket?: number;
  pricePerUnit?: number;
  basicPricePerUnit?: number;
  comboSubtotalInclGst?: number;
  [key: string]: unknown;
}

export interface QuotationPdfOrderData {
  id: string;
  createdAt: string;
  serialNo: string;
  fullName?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  companyName?: string;
  gstin?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  totalPrice: number;
  orderSummary: QuotationPdfOrderSummary;
  cartItems: QuotationPdfCartLine[];
}

function formatInr(n: number) {
  const x = roundMoney(n);
  return "Rs. " + x.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Amount strings for AutoTable — use ASCII "Rs." so standard PDF fonts never render ₹ as a stray superscript. */
function formatInrRupee(n: number) {
  const x = roundMoney(n);
  return "Rs. " + x.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Rate column: GST-exclusive numeric (no currency), sample-style. */
function formatRatePlain(n: number): string {
  return roundMoney(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDueOnLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const mon = d.toLocaleString("en-GB", { month: "short" });
  const yy = String(d.getFullYear()).slice(-2);
  /** Non-breaking hyphens (U+2011) so the date never wraps as e.g. "27-Apr-2" / "6". */
  const nb = "\u2011";
  return `${day}${nb}${mon}${nb}${yy}`;
}

function asLine(x: unknown): QuotationPdfCartLine {
  return (x && typeof x === "object" ? (x as QuotationPdfCartLine) : {}) as QuotationPdfCartLine;
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

const pricingCtx = (item: QuotationPdfCartLine) => ({
  orderMode: item.orderMode,
  quantity: Number(item.quantity) || 0,
  qtyPerBag: Number(item.qtyPerBag) || 0,
  pcsPerPacket: Number(item.pcsPerPacket) || 0,
});

function linePacketCount(item: QuotationPdfCartLine): number {
  return pricedPacketCount(pricingCtx(item));
}

/** Ex-GST rate per packet (cart `pricePerUnit` is GST-inclusive per packet). */
function unitPriceExGst(item: QuotationPdfCartLine): number {
  const combo = item.comboSubtotalInclGst;
  const pk = linePacketCount(item);
  if (typeof combo === "number" && combo > 0 && pk > 0) {
    return roundMoney(combo / pk / GST_INCLUSIVE_DIVISOR);
  }
  if (typeof combo === "number" && combo > 0 && pk <= 0) {
    return 0;
  }
  return roundMoney((Number(item.pricePerUnit) || 0) / GST_INCLUSIVE_DIVISOR);
}

/** Taxable line amount = (Rate ex-GST) × (total packets). Combo: inclusive subtotal ÷ 1.18. */
function rowAmountExGst(item: QuotationPdfCartLine): number {
  const combo = item.comboSubtotalInclGst;
  if (typeof combo === "number" && combo > 0) {
    return roundMoney(combo / GST_INCLUSIVE_DIVISOR);
  }
  const pk = linePacketCount(item);
  return roundMoney(unitPriceExGst(item) * pk);
}

/** Outer bags: master mode uses `quantity` as bags; packet mode uses packets ÷ qtyPerBag when set. */
function altQuantityCell(item: QuotationPdfCartLine): string {
  if (normalizeOrderMode(item.orderMode) === "master_bag") {
    const bags = Math.max(0, Math.floor(Number(item.quantity) || 0));
    if (bags <= 0) return "—";
    return bags === 1 ? "1\u00A0bag" : `${bags}\u00A0bags`;
  }
  const q = Number(item.quantity) || 0;
  const qpb = Number(item.qtyPerBag) || 0;
  if (qpb <= 0 || q <= 0) return "—";
  const bags = q / qpb;
  const n = roundMoney(bags);
  if (n <= 0) return "—";
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.001) {
    const b = Math.round(n);
    return b === 1 ? "1\u00A0bag" : `${b}\u00A0bags`;
  }
  return `${n}\u00A0bags`;
}

function quantityDisplayCell(item: QuotationPdfCartLine): string {
  const pk = linePacketCount(item);
  return pk.toLocaleString("en-IN") + "\u00A0pkts";
}

function perUnitLabel(_item: QuotationPdfCartLine): string {
  return "Pkt";
}

function productDetailsText(item: QuotationPdfCartLine): string {
  const raw = String(item.productName ?? "").trim() || "—";
  const name = raw === "—" ? raw : raw.toUpperCase();
  const v = brandVariantLabel(item);
  if (v === "—") return name;
  return name + "\n" + v;
}

function brandVariantLabel(item: QuotationPdfCartLine): string {
  const b = (item.brand ?? "").trim();
  const s = (item.size ?? "").trim();
  if (b && s) return b + " — " + s;
  if (s) return s;
  if (b) return b;
  return "—";
}

/**
 * Fixed minimum widths (mm) for narrow columns so headers/body don't wrap one character per line.
 * Description absorbs the remainder (target ≥ ~34% of table).
 */
function tableColumnWidths(innerW: number): number[] {
  const targetDesc = Math.max(roundMoney(innerW * 0.34), 52);
  let wSr = 11;
  let wDue = 16;
  let wAlt = 21;
  let wQty = 24;
  let wRate = 13;
  let wPer = 10;
  let wDisc = 12;
  let wAmt = 28;
  let wDesc = roundMoney(innerW - (wSr + wDue + wAlt + wQty + wRate + wPer + wDisc + wAmt));
  if (wDesc < targetDesc) {
    const need = targetDesc - wDesc;
    const parts = [wSr, wDue, wAlt, wQty, wRate, wPer, wDisc, wAmt];
    const sumParts = parts.reduce((a, b) => a + b, 0);
    const factor = Math.max(0.55, (sumParts - need) / sumParts);
    wSr = roundMoney(wSr * factor);
    wDue = roundMoney(wDue * factor);
    wAlt = roundMoney(wAlt * factor);
    wQty = roundMoney(wQty * factor);
    wRate = roundMoney(wRate * factor);
    wPer = roundMoney(wPer * factor);
    wDisc = roundMoney(wDisc * factor);
    wAmt = roundMoney(wAmt * factor);
    wDesc = roundMoney(innerW - (wSr + wDue + wAlt + wQty + wRate + wPer + wDisc + wAmt));
  }
  const out = [wSr, wDesc, wDue, wAlt, wQty, wRate, wPer, wDisc, wAmt];
  const drift = roundMoney(innerW - out.reduce((a, b) => a + b, 0));
  out[8] = roundMoney(out[8] + drift);
  return out;
}

async function tryLoadLogoDataUrl(logoPath: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const url = logoPath.startsWith("http")
      ? logoPath
      : window.location.origin.replace(/\/$/, "") + "/" + logoPath.replace(/^\//, "");
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("read"));
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface QuotationPdfResult {
  blob: Blob;
  base64: string;
  dataUrl: string;
  suggestedFilename: string;
}

export type GenerateQuotationPdfOptions = {
  saveDownload?: boolean;
};

/**
 * Quotation PDF: black & white grid table, ex-GST math from inclusive prices ÷ 1.18.
 */
export async function generateQuotationPDF(
  orderData: QuotationPdfOrderData,
  options: GenerateQuotationPdfOptions = {}
): Promise<QuotationPdfResult> {
  const saveDownload = options.saveDownload !== false;

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setFont("helvetica", "normal");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  let y = margin;

  const imgData = await tryLoadLogoDataUrl(RPT_LOGO_PATH);
  const logoW = 26;
  const logoH = 26;
  if (imgData) {
    try {
      doc.addImage(imgData, "JPEG", margin, y, logoW, logoH);
    } catch {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("[Logo]", margin, y + 8);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("RPT", margin, y + 10);
  }

  const textStartX = margin + logoW + 5;
  let ty = y + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(SELLER.name, textStartX, ty);
  ty += 4.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const addrW = pageW - textStartX - 55;
  const addrLines = doc.splitTextToSize(SELLER.address, addrW) as string[];
  for (const ln of addrLines) {
    doc.text(ln, textStartX, ty);
    ty += 3.2;
  }
  doc.text("Contact: " + SELLER.contact + " | Email: " + SELLER.email, textStartX, ty);
  ty += 3.2;
  const gstLines = doc.splitTextToSize(SELLER.gst, addrW) as string[];
  for (const ln of gstLines) {
    doc.text(ln, textStartX, ty);
    ty += 3.2;
  }
  const headerTextBottom = ty + 1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text("QUOTATION", pageW - margin, y + 6, { align: "right" });

  y = Math.max(margin + logoH, headerTextBottom) + 3;
  doc.setDrawColor(GRID_LINE[0], GRID_LINE[1], GRID_LINE[2]);
  doc.setLineWidth(0.35);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  const dateStr = new Date(orderData.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const colGap = 10;
  const colW = (pageW - 2 * margin - colGap) / 2;
  const leftX = margin;
  const rightX = margin + colW + colGap;
  const blockTop = y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.text("BUYER (BILL TO):", leftX, y);
  doc.text("QUOTATION DETAILS:", rightX, y);
  y += 4.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const company = orderData.companyName?.trim() || "";
  const buyerName = orderData.fullName?.trim() || orderData.customerName?.trim() || "—";
  const street = orderData.streetAddress?.trim() || "";
  const city = orderData.city?.trim() || "";
  const state = orderData.state?.trim() || "";
  const pincode = orderData.pincode?.trim() || "";
  const gstin = orderData.gstin?.trim() || "";

  const buyerHeader = company || buyerName;
  doc.setFont("helvetica", "bold");
  doc.text(buyerHeader, leftX, y);
  doc.setFont("helvetica", "normal");
  y += 3.6;

  if (company && buyerName && company !== buyerName) {
    doc.text("Attn: " + buyerName, leftX, y);
    y += 3.6;
  }

  if (street) {
    const streetLines = doc.splitTextToSize(street, colW) as string[];
    for (const ln of streetLines) {
      doc.text(ln, leftX, y);
      y += 3.6;
    }
  }

  const cityLineParts = [city, state, pincode].filter(Boolean);
  if (cityLineParts.length > 0) {
    doc.text(cityLineParts.join(", "), leftX, y);
    y += 3.6;
  }

  if (gstin) {
    doc.text("GSTIN: " + gstin, leftX, y);
    y += 3.6;
  }

  doc.text("Phone: " + String(orderData.customerPhone), leftX, y);
  y += 3.6;
  if (orderData.customerEmail?.trim()) {
    doc.text("Email: " + orderData.customerEmail.trim(), leftX, y);
    y += 3.6;
  }
  const leftBlockEnd = y;

  let ry = blockTop + 4.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Quotation ID: " + String(orderData.serialNo), rightX, ry);
  ry += 3.6;
  doc.text("Date: " + dateStr, rightX, ry);
  ry += 3.6;
  const rightBlockEnd = ry;

  y = Math.max(leftBlockEnd, rightBlockEnd) + 5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  const items = orderData.cartItems.map(asLine);
  const innerW = pageW - 2 * margin;
  const [wSr, wDesc, wDue, wAltQty, wQty, wRate, wPer, wDisc, wAmt] = tableColumnWidths(innerW);

  const dueLabel = formatDueOnLabel(orderData.createdAt);

  const itemRows: string[][] = items.map((it, i) => [
    String(i + 1),
    productDetailsText(it),
    dueLabel,
    altQuantityCell(it),
    quantityDisplayCell(it),
    formatRatePlain(unitPriceExGst(it)),
    perUnitLabel(it),
    "—",
    formatInrRupee(rowAmountExGst(it)),
  ]);

  const subtotal = roundMoney(items.reduce((s, it) => s + rowAmountExGst(it), 0));
  const igst = roundMoney(subtotal * 0.18);
  const preRound = roundMoney(subtotal + igst);
  const grandTotal = Math.round(preRound);
  const roundOff = roundMoney(grandTotal - preRound);

  let sumBags = 0;
  let anyBagLine = false;
  for (const it of items) {
    if (normalizeOrderMode(it.orderMode) === "master_bag") {
      sumBags += Math.max(0, Math.floor(Number(it.quantity) || 0));
      anyBagLine = true;
    } else {
      const q = Number(it.quantity) || 0;
      const qpb = Number(it.qtyPerBag) || 0;
      if (qpb > 0 && q > 0) {
        sumBags += q / qpb;
        anyBagLine = true;
      }
    }
  }
  const sumPkts = items.reduce((s, it) => s + linePacketCount(it), 0);
  const altQtyFooter =
    !anyBagLine || sumBags <= 0
      ? "—"
      : (() => {
          const n = roundMoney(sumBags);
          if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.001) {
            const b = Math.round(n);
            return b === 1 ? "1\u00A0bag" : `${b}\u00A0bags`;
          }
          return `${n}\u00A0bags`;
        })();
  const qtyFooter = sumPkts.toLocaleString("en-IN") + "\u00A0pkts";

  type FootCell = string | { content: string; colSpan?: number; styles?: Record<string, unknown> };
  /** Sample-style footer: subtotal amount; I GST / Round Off labels in Description; Total spans + column sums. */
  const footRows: FootCell[][] = [
    [{ content: "", colSpan: 8 }, formatInrRupee(subtotal)],
    ["", "I GST", "", "", "", "", "", "", formatInrRupee(igst)],
    ["", "Round Off", "", "", "", "", "", "", formatInrRupee(roundOff)],
    [
      { content: "Total", colSpan: 3, styles: { halign: "left", fontStyle: "bold" } },
      altQtyFooter,
      qtyFooter,
      "",
      "",
      "—",
      formatInrRupee(grandTotal),
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Sl.\nNo.",
        "Description of Goods",
        "Due\non",
        "Alt.\nQty",
        "Quantity",
        "Rate",
        "per",
        "Disc.\n%",
        "Amount",
      ],
    ],
    body: itemRows,
    foot: footRows,
    theme: "grid",
    showFoot: "lastPage",
    headStyles: {
      ...TABLE_HEAD_FOOT,
      halign: "center",
      fontSize: 7.5,
      valign: "middle",
      cellPadding: 1.6,
    },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "normal",
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      halign: "right",
    },
    styles: {
      fontSize: 7.2,
      cellPadding: { top: 1.8, right: 1.2, bottom: 1.8, left: 1.2 },
      textColor: [0, 0, 0],
      overflow: "linebreak",
      fillColor: [255, 255, 255],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      font: "helvetica",
    },
    columnStyles: {
      0: { cellWidth: wSr, halign: "center" },
      1: { cellWidth: wDesc, halign: "left" },
      2: { cellWidth: wDue, halign: "left" },
      3: { cellWidth: wAltQty, halign: "left", fontSize: 7 },
      4: { cellWidth: wQty, halign: "right", fontSize: 7 },
      5: { cellWidth: wRate, halign: "right" },
      6: { cellWidth: wPer, halign: "center" },
      7: { cellWidth: wDisc, halign: "center" },
      8: { cellWidth: wAmt, halign: "right" },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === "head") {
        const i = data.column.index;
        data.cell.styles.fontSize = 7.5;
        data.cell.styles.cellPadding = 1.5;
        if (i === 1) data.cell.styles.halign = "left";
        else if (i === 0 || i === 2 || i === 3 || i === 6 || i === 7) data.cell.styles.halign = "center";
        else if (i === 4) data.cell.styles.halign = "center";
        else data.cell.styles.halign = "right";
        Object.assign(data.cell.styles, TABLE_HEAD_FOOT);
      }
      if (data.section === "body") {
        if (data.column.index === 1) {
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index === 2) {
          data.cell.styles.fontStyle = "italic";
          data.cell.styles.halign = "left";
          data.cell.styles.fontSize = 6.9;
        }
        if (data.column.index === 3 || data.column.index === 4) {
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index === 3) {
          data.cell.styles.halign = "left";
        }
        if (data.column.index === 4 || data.column.index === 5 || data.column.index === 8) {
          data.cell.styles.halign = "right";
        }
        if (data.column.index === 6) {
          data.cell.styles.fontSize = 7;
        }
      }
      if (data.section === "foot") {
        data.cell.styles.fillColor = [255, 255, 255];
        data.cell.styles.textColor = [0, 0, 0];
        data.cell.styles.lineColor = [0, 0, 0];
        data.cell.styles.fontStyle = "normal";
        const fr = data.row.index;
        const ci = data.column.index;

        const edge = 0.12;

        /** Subtotal row: keep top + outer left/right; vertical before Amount; no bottom. */
        if (fr === 0) {
          if (ci === 8) {
            data.cell.styles.halign = "right";
            data.cell.styles.lineWidth = { top: 0.25, right: edge, bottom: 0, left: edge };
          } else {
            data.cell.styles.lineWidth = { top: 0.1, right: edge, bottom: 0, left: ci === 0 ? edge : 0 };
          }
        }

        /**
         * I GST + Round Off: no inner grid — keep continuous outer left/right so corners
         * align with body and Total row.
         */
        if (fr === 1 || fr === 2) {
          data.cell.styles.lineWidth = {
            top: 0,
            bottom: 0,
            left: ci === 0 ? edge : 0,
            right: ci === 8 ? edge : 0,
          };
        }
        if (fr === 1 && ci === 1) {
          data.cell.styles.fontStyle = "bolditalic";
          data.cell.styles.halign = "right";
        }
        if (fr === 2 && ci === 1) {
          data.cell.styles.fontStyle = "bolditalic";
          data.cell.styles.halign = "right";
        }
        if (fr === 1 || fr === 2) {
          if (ci === 8) data.cell.styles.halign = "right";
        }

        /** Total row: full grid + heavier bottom to close the table. */
        if (fr === 3) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.lineWidth = { top: 0.35, right: edge, bottom: 0.45, left: edge };
          if (ci === 0) data.cell.styles.halign = "left";
          if (ci === 3) data.cell.styles.halign = "left";
          if (ci === 4) data.cell.styles.halign = "right";
          if (ci === 8) {
            data.cell.styles.halign = "right";
            data.cell.styles.fontSize = 9;
          }
        }
      }
    },
  });

  const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  y = typeof tableEnd === "number" ? tableEnd + 6 : y + 50;

  doc.setTextColor(30, 30, 30);
  if (y > pageH - 55) {
    doc.addPage();
    y = margin;
  } else {
    y += 4;
  }

  const yFoot = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("COMPANY'S BANK DETAILS:", leftX, yFoot);
  y = yFoot + 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 50);
  const payLines = [
    "A/c Holder's Name: " + BANK.accountHolder,
    "Bank Name: " + BANK.bankName,
    "A/c No.: " + BANK.accountNo,
    "Branch & IFSC Code: " + BANK.branchAndIfsc,
  ];
  for (const pl of payLines) {
    const lines = doc.splitTextToSize(pl, pageW - 2 * margin) as string[];
    for (const ln of lines) {
      doc.text(ln, leftX, y);
      y += 3.4;
    }
  }
  y += 8;

  doc.setDrawColor(180, 185, 195);
  doc.setLineWidth(0.5);
  if (y < pageH - 20) {
    doc.line(margin, y, pageW - margin, y);
  }

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  const ft = doc.splitTextToSize(DOC_FOOTER_NOTE, pageW - 2 * margin) as string[];
  for (const line of ft) {
    const lw = doc.getTextWidth(line);
    doc.text(line, (pageW - lw) / 2, y);
    y += 3.2;
  }

  const dataUri = doc.output("datauristring");
  const comma = dataUri.indexOf(",");
  const base64 = comma >= 0 ? dataUri.slice(comma + 1) : dataUri;
  const outBlob = doc.output("blob");
  const safeName = "Quotation-" + orderData.serialNo.replace(/[^a-zA-Z0-9-]+/g, "-") + ".pdf";
  if (saveDownload) {
    doc.save(safeName);
  }

  return { blob: outBlob, base64, dataUrl: dataUri, suggestedFilename: safeName };
}
