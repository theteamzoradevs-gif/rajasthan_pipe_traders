import { NextRequest, NextResponse } from "next/server";
import { logApiRouteError } from "@/lib/http/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOUBLETICK_BASE_URL = "https://public.doubletick.io";
const UPLOAD_PATH = "/media/upload";
const TEMPLATE_PATH = "/whatsapp/message/template";

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

/** DoubleTick expects E.164-style numbers without "+" (e.g. 919327071674). 10-digit India numbers get "91" prefix. */
function normalizeIndianMsisdn(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/** DoubleTick `media/upload` may return the media URL under a few different keys depending on version. */
function extractMediaUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  const candidates = [o.url, o.mediaUrl, o.media_url, o.fileUrl, o.file_url];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  const data = o.data;
  if (data && typeof data === "object") {
    return extractMediaUrl(data);
  }
  return null;
}

async function uploadToDoubleTick(
  apiKey: string,
  pdfBlob: Blob,
  filename: string
): Promise<string> {
  const fd = new FormData();
  fd.append("file", pdfBlob, filename);

  const res = await fetch(DOUBLETICK_BASE_URL + UPLOAD_PATH, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
    },
    body: fd,
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /** Non-JSON responses fall through and the raw text is included in the error below. */
  }

  if (!res.ok) {
    const detail =
      json && typeof json === "object" && "message" in (json as Record<string, unknown>)
        ? String((json as Record<string, unknown>).message)
        : text || `HTTP ${res.status}`;
    throw new Error(`DoubleTick upload failed: ${detail}`);
  }

  const url = extractMediaUrl(json);
  if (!url) {
    throw new Error("DoubleTick upload succeeded but no media URL was returned.");
  }
  return url;
}

interface SendTemplateArgs {
  apiKey: string;
  senderNumber: string;
  customerNumber: string;
  templateName: string;
  language: string;
  /** Body placeholders {{1}}, {{2}}, ... in the order Meta-approved on the dashboard. */
  bodyPlaceholders: string[];
  /** Document header attached to the template; falsy → no header is sent. */
  documentHeader?: { mediaUrl: string; filename: string };
}

/**
 * Sends a Meta-approved template message via DoubleTick.
 * Templates bypass the 24-hour customer service window, so they can be sent at any time.
 */
async function sendTemplateMessage(args: SendTemplateArgs): Promise<unknown> {
  const templateData: Record<string, unknown> = {
    body: { placeholders: args.bodyPlaceholders },
  };
  if (args.documentHeader) {
    templateData.header = {
      type: "DOCUMENT",
      mediaUrl: args.documentHeader.mediaUrl,
      filename: args.documentHeader.filename,
    };
  }

  const res = await fetch(DOUBLETICK_BASE_URL + TEMPLATE_PATH, {
    method: "POST",
    headers: {
      Authorization: args.apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          content: {
            language: args.language,
            templateName: args.templateName,
            templateData,
          },
          from: args.senderNumber,
          to: args.customerNumber,
        },
      ],
    }),
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /** Non-JSON responses fall through; raw text becomes the error detail. */
  }

  if (!res.ok) {
    const detail =
      json && typeof json === "object" && "message" in (json as Record<string, unknown>)
        ? String((json as Record<string, unknown>).message)
        : text || `HTTP ${res.status}`;
    throw new Error(`DoubleTick send failed: ${detail}`);
  }
  return json;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.DOUBLETICK_API_KEY?.trim();
    const senderRaw = process.env.DOUBLETICK_SENDER_NUMBER?.trim();
    const templateName = process.env.DOUBLETICK_TEMPLATE_NAME?.trim();
    const templateLanguage = process.env.DOUBLETICK_TEMPLATE_LANGUAGE?.trim() || "en";
    if (!apiKey || !senderRaw || !templateName) {
      return err(
        "WhatsApp service is not configured. Set DOUBLETICK_API_KEY, DOUBLETICK_SENDER_NUMBER and DOUBLETICK_TEMPLATE_NAME.",
        503
      );
    }
    const sender = normalizeIndianMsisdn(senderRaw);
    if (!sender) {
      return err("DOUBLETICK_SENDER_NUMBER is not a valid phone number.", 503);
    }

    const form = await req.formData();
    const file = form.get("file");
    const customerPhoneRaw = form.get("customerPhone");
    const customerName = form.get("customerName");
    const serialNo = form.get("serialNo");

    if (!file || !(file instanceof File)) {
      return err("Missing PDF file field.", 400);
    }
    if (typeof customerPhoneRaw !== "string" || !customerPhoneRaw.trim()) {
      return err("customerPhone is required.", 400);
    }

    const customerNumber = normalizeIndianMsisdn(customerPhoneRaw);
    if (!customerNumber) {
      return err("customerPhone is not a valid phone number.", 400);
    }

    const safeSerial =
      typeof serialNo === "string" && serialNo.trim()
        ? serialNo.trim().replace(/[^a-zA-Z0-9-]+/g, "-")
        : "Quotation";
    const displayName =
      typeof customerName === "string" && customerName.trim() ? customerName.trim() : "there";
    const filename = `Quotation-${safeSerial}.pdf`;

    /** Convert the uploaded File into a typed Blob so DoubleTick's multipart receives `application/pdf`. */
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfBlob = new Blob([buffer], { type: file.type || "application/pdf" });

    const mediaUrl = await uploadToDoubleTick(apiKey, pdfBlob, filename);

    /** Body placeholders must match the Meta-approved template body in order: {{1}} = name, {{2}} = serial. */
    await sendTemplateMessage({
      apiKey,
      senderNumber: sender,
      customerNumber,
      templateName,
      language: templateLanguage,
      bodyPlaceholders: [displayName, safeSerial],
      documentHeader: { mediaUrl, filename },
    });

    return NextResponse.json(
      { data: { mediaUrl, sentTo: customerNumber, templateName } },
      { status: 200 }
    );
  } catch (e) {
    logApiRouteError("POST /api/whatsapp/send-quotation", e);
    const message = e instanceof Error ? e.message : "Failed to send WhatsApp message.";
    return err(message, 500);
  }
}
