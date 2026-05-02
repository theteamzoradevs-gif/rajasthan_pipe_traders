import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { put } from "@vercel/blob";
import { connectDb } from "@/lib/db/connect";
import { OrderModel } from "@/lib/db/models/Order";
import { LeadModel } from "@/lib/db/models/Lead";
import { orderSerialFromMongoId } from "@/lib/utils/orderSerialFromId";
import { logApiRouteError } from "@/lib/http/apiError";
import {
  generateQuotationPDF,
  type QuotationPdfOrderData,
} from "@/lib/utils/generateQuotationPDF";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

const PHONE_RE = /^\d{10}$/;

function parseOrderSummary(
  body: Record<string, unknown>
): Record<string, unknown> | null | undefined {
  const o = body.orderSummary;
  if (o == null) return undefined;
  if (typeof o === "object" && !Array.isArray(o)) {
    return o as Record<string, unknown>;
  }
  return null;
}

/** Optional string from JSON body: missing, non-string, or whitespace-only → undefined (allowed). */
function optString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const {
      fullName: fullNameIn,
      customerName: customerNameIn,
      phoneNumber: phoneNumberIn,
      customerPhone: customerPhoneIn,
      customerEmail: customerEmailIn,
      cartItems: cartItemsRaw,
      companyName: companyNameIn,
      gstin: gstinIn,
      addressTitle: addressTitleIn,
      streetAddress: streetAddressIn,
      area: areaIn,
      landmark: landmarkIn,
      pincode: pincodeIn,
      city: cityIn,
      state: stateIn,
      country: countryIn,
    } = body;

    const fullName =
      (typeof fullNameIn === "string" ? fullNameIn.trim() : "") ||
      (typeof customerNameIn === "string" ? customerNameIn.trim() : "");
    const phoneRaw =
      typeof phoneNumberIn === "string"
        ? phoneNumberIn
        : typeof customerPhoneIn === "string"
          ? customerPhoneIn
          : "";
    const customerPhone = phoneRaw.replace(/\D/g, "");
    const customerEmail = typeof customerEmailIn === "string" ? customerEmailIn.trim() : "";

    const companyName = optString(companyNameIn);
    const gstin = optString(gstinIn);
    const addressTitle = optString(addressTitleIn);
    const streetAddress = optString(streetAddressIn);
    const area = optString(areaIn);
    const landmark = optString(landmarkIn);
    const pincode = optString(pincodeIn);
    const city = optString(cityIn);
    const state = optString(stateIn);
    const country = optString(countryIn);

    const orderSummary = parseOrderSummary(body);

    const totalFromBody = body.totalPrice;
    const totalFromSummary =
      orderSummary && typeof orderSummary["finalTotal"] === "number"
        ? (orderSummary["finalTotal"] as number)
        : typeof orderSummary?.["grandTotalInclGst"] === "number"
          ? (orderSummary["grandTotalInclGst"] as number)
          : null;
    const totalPrice =
      typeof totalFromBody === "number" && Number.isFinite(totalFromBody)
        ? totalFromBody
        : totalFromSummary;

    /** Storefront form marks only phone as required; persist a placeholder when name is omitted. */
    const resolvedFullName = fullName || "—";
    const customerName = resolvedFullName;

    if (!customerPhone) {
      return err("phoneNumber is required", 400);
    }

    if (!PHONE_RE.test(customerPhone)) {
      return err("Phone must be exactly 10 digits", 400);
    }

    if (!Array.isArray(cartItemsRaw) || cartItemsRaw.length === 0) {
      return err("cartItems must be a non-empty array", 400);
    }

    if (orderSummary === null) {
      return err("orderSummary, if present, must be an object", 400);
    }

    if (totalPrice == null || typeof totalPrice !== "number" || !Number.isFinite(totalPrice) || totalPrice < 0) {
      return err("totalPrice is required and must be a non-negative number", 400);
    }

    /** Email is optional; when present it must be valid. Empty string is allowed. */
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return err("Invalid email address", 400);
    }

    await connectDb();

    /** Persist quotation only after validation; 201 is returned only when this succeeds. */
    const row = await OrderModel.create({
      fullName: resolvedFullName,
      phoneNumber: customerPhone,
      customerName,
      customerPhone,
      customerEmail,
      companyName,
      gstin,
      addressTitle,
      streetAddress,
      area,
      landmark,
      pincode,
      city,
      state,
      ...(country !== undefined ? { country } : {}),
      cartItems: cartItemsRaw,
      totalPrice,
      ...(orderSummary != null ? { orderSummary } : {}),
    });

    try {
      await LeadModel.findOneAndUpdate(
        { phone: customerPhone },
        {
          $set: {
            status: "ordered",
            itemsInCart: cartItemsRaw,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true, new: true }
      );
    } catch {
      /* lead update is best-effort */
    }

    const o = row.toObject();
    const id = o._id instanceof mongoose.Types.ObjectId ? o._id.toString() : String(o._id);
    const cAt = o.createdAt;
    const dateIso = cAt instanceof Date ? cAt.toISOString() : new Date().toISOString();
    const serialNo = orderSerialFromMongoId(id);

    let quotationPdfBlobUrl: string | undefined;
    try {
      const pdfOrderSummary =
        o.orderSummary && typeof o.orderSummary === "object" && !Array.isArray(o.orderSummary)
          ? (o.orderSummary as QuotationPdfOrderData["orderSummary"])
          : {};
      const pdfCartItems = Array.isArray(o.cartItems) ? o.cartItems : [];
      const pdfName =
        (typeof o.fullName === "string" && o.fullName.trim() ? o.fullName : "") ||
        (typeof o.customerName === "string" ? o.customerName : "");
      const pdfPhone =
        (typeof o.phoneNumber === "string" && o.phoneNumber.trim() ? o.phoneNumber : "") ||
        (typeof o.customerPhone === "string" ? o.customerPhone : "");
      const quotationPdfPayload: QuotationPdfOrderData = {
        id,
        serialNo,
        createdAt: dateIso,
        fullName: typeof o.fullName === "string" ? o.fullName : "",
        customerName: pdfName,
        customerPhone: pdfPhone,
        customerEmail: typeof o.customerEmail === "string" ? o.customerEmail : "",
        companyName: typeof o.companyName === "string" ? o.companyName : "",
        gstin: typeof o.gstin === "string" ? o.gstin : "",
        streetAddress: typeof o.streetAddress === "string" ? o.streetAddress : "",
        city: typeof o.city === "string" ? o.city : "",
        state: typeof o.state === "string" ? o.state : "",
        pincode: typeof o.pincode === "string" ? o.pincode : "",
        totalPrice:
          typeof o.totalPrice === "number" && Number.isFinite(o.totalPrice) ? o.totalPrice : 0,
        orderSummary: pdfOrderSummary,
        cartItems: pdfCartItems as QuotationPdfOrderData["cartItems"],
      };

      const { blob: pdfBlob } = await generateQuotationPDF(quotationPdfPayload, {
        saveDownload: false,
      });

      const uploaded = await put(`quotations/Quotation-${id}.pdf`, pdfBlob, {
        access: "public",
        contentType: "application/pdf",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      quotationPdfBlobUrl = uploaded.url;
    } catch (e) {
      logApiRouteError("POST /api/quotation-request quotation PDF blob upload", e);
    }

    return NextResponse.json(
      {
        data: {
          id,
          serialNo,
          createdAt: dateIso,
          fullName: typeof o.fullName === "string" ? o.fullName : (o.customerName as string) ?? "",
          phoneNumber: typeof o.phoneNumber === "string" ? o.phoneNumber : (o.customerPhone as string) ?? "",
          customerName: typeof o.customerName === "string" ? o.customerName : (o.fullName as string) ?? "",
          customerPhone: typeof o.customerPhone === "string" ? o.customerPhone : (o.phoneNumber as string) ?? "",
          customerEmail: o.customerEmail ?? "",
          companyName: o.companyName,
          gstin: o.gstin,
          addressTitle: o.addressTitle,
          streetAddress: o.streetAddress,
          area: o.area,
          landmark: o.landmark,
          pincode: o.pincode,
          city: o.city,
          state: o.state,
          country: typeof o.country === "string" ? o.country : "India",
          totalPrice: o.totalPrice,
          orderSummary: (o.orderSummary as Record<string, unknown> | undefined) ?? {},
          cartItems: (o.cartItems as unknown[]) ?? [],
          quotationPdfUrl: quotationPdfBlobUrl ?? null,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    logApiRouteError("POST /api/quotation-request", e);
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
