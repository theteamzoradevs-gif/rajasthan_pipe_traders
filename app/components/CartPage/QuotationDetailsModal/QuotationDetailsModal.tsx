"use client";

import React, { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./QuotationDetailsModal.module.css";
import {
  generateQuotationPDF,
  type QuotationPdfOrderData,
} from "@/lib/utils/generateQuotationPDF";

const PHONE_OK = /^\d{10}$/;

function digitsOnly(s: string, max: number) {
  return s.replace(/\D/g, "").slice(0, max);
}

export interface QuotationFormValues {
  fullName: string;
  phone: string;
  email: string;
  companyName: string;
  gstin: string;
  addressTitle: string;
  streetAddress: string;
  area: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
  country: string;
}

interface QuotationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * POST the order; must resolve with the same payload the PDF generator expects
   * (as returned from POST /api/quotation-request).
   */
  submitQuotation: (data: QuotationFormValues) => Promise<QuotationPdfOrderData>;
  /** After API + PDF; parent opens success, closes dialog. */
  onQuotationSuccess: () => void;
}

type LoadPhase = "idle" | "saving" | "generating" | "sending";

async function sendQuotationOnWhatsApp(args: {
  blob: Blob;
  filename: string;
  customerPhone: string;
  customerName: string;
  serialNo: string;
}): Promise<void> {
  const fd = new FormData();
  fd.append("file", args.blob, args.filename);
  fd.append("customerPhone", args.customerPhone);
  fd.append("customerName", args.customerName);
  fd.append("serialNo", args.serialNo);
  const res = await fetch("/api/whatsapp/send-quotation", { method: "POST", body: fd });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message ?? `WhatsApp send failed (HTTP ${res.status})`);
  }
}

export default function QuotationDetailsModal({
  isOpen,
  onClose,
  submitQuotation,
  onQuotationSuccess,
}: QuotationDetailsModalProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [addressTitle, setAddressTitle] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [area, setArea] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("India");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isBusy = phase !== "idle";
  const labelId = useId();
  const descId = useId();

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setFullName("");
      setPhone("");
      setEmail("");
      setCompanyName("");
      setGstin("");
      setAddressTitle("");
      setStreetAddress("");
      setArea("");
      setLandmark("");
      setPincode("");
      setCity("");
      setState("");
      setCountry("India");
      setPhoneTouched(false);
      setPhase("idle");
      setSubmitError(null);
    }
  }, [isOpen]);

  const phoneValid = PHONE_OK.test(phone);
  const phoneShowError = phoneTouched && phone.length > 0 && !phoneValid;
  const canSubmit = phoneValid && !isBusy;

  const onPhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(digitsOnly(e.target.value, 10));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setPhase("saving");
    setSubmitError(null);
    const form: QuotationFormValues = {
      fullName: fullName.trim(),
      phone,
      email: email.trim(),
      companyName: companyName.trim(),
      gstin: gstin.trim(),
      addressTitle: addressTitle.trim(),
      streetAddress: streetAddress.trim(),
      area: area.trim(),
      landmark: landmark.trim(),
      pincode: pincode.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim() || "India",
    };
    try {
      const orderData = await submitQuotation(form);
      setPhase("generating");
      // PDF uses only this API payload (orderSummary + totalPrice + cart lines) so totals match the cart.
      const pdf = await generateQuotationPDF(orderData);

      setPhase("sending");
      /** WhatsApp delivery is best-effort: order is already saved & PDF downloaded, so a failure here must not block success. */
      try {
        await sendQuotationOnWhatsApp({
          blob: pdf.blob,
          filename: pdf.suggestedFilename,
          customerPhone: orderData.customerPhone,
          customerName:
            orderData.fullName?.trim() || orderData.customerName?.trim() || form.fullName,
          serialNo: orderData.serialNo,
        });
      } catch (whatsappErr) {
        console.warn("WhatsApp delivery failed (order still placed):", whatsappErr);
      }

      onQuotationSuccess();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not complete your request.";
      setSubmitError(message);
    } finally {
      setPhase("idle");
    }
  }, [
    canSubmit,
    submitQuotation,
    fullName,
    phone,
    email,
    companyName,
    gstin,
    addressTitle,
    streetAddress,
    area,
    landmark,
    pincode,
    city,
    state,
    country,
    onQuotationSuccess,
  ]);

  if (!isOpen) return null;

  const content = (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={isBusy ? undefined : onClose}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !isBusy) onClose();
        }}
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          disabled={isBusy}
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className={styles.header}>
          <h2 className={styles.title} id={labelId}>
            Confirm Your Details
          </h2>
          <p className={styles.subtitle} id={descId}>
            A professional quotation will be generated based on this info.
          </p>
        </div>

        <div className={styles.fields}>
          <div>
            <label className={styles.label} htmlFor="quotation-fullname">
              Full Name
            </label>
            <input
              id="quotation-fullname"
              className={styles.input}
              type="text"
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isBusy}
              placeholder="Your name"
            />
          </div>

          <div>
            <label className={styles.label} htmlFor="quotation-phone">
              Phone Number<span className={styles.requiredAsterisk} aria-hidden="true"> *</span>
            </label>
            <input
              id="quotation-phone"
              className={`${styles.input} ${phoneShowError ? styles.inputError : ""}`}
              type="tel"
              name="phone"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={onPhoneChange}
              onBlur={() => setPhoneTouched(true)}
              disabled={isBusy}
              placeholder="10-digit mobile number"
              aria-required
              aria-invalid={phoneShowError}
              aria-describedby="quotation-phone-err"
            />
            <p className={styles.fieldError} id="quotation-phone-err">
              {phoneShowError ? "Enter exactly 10 digits" : ""}
            </p>
          </div>

          <div>
            <label className={styles.label} htmlFor="quotation-email">
              Email
            </label>
            <input
              id="quotation-email"
              className={styles.input}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isBusy}
              placeholder="you@example.com"
            />
          </div>

          <div className={styles.section} aria-labelledby="quotation-section-company">
            <h3 className={styles.sectionTitle} id="quotation-section-company">
              Company information
            </h3>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="quotation-company">
                  Company name
                </label>
                <input
                  id="quotation-company"
                  className={styles.input}
                  type="text"
                  name="companyName"
                  autoComplete="organization"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isBusy}
                  placeholder="Registered business name"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="quotation-gstin">
                  GSTIN / Tax code
                </label>
                <input
                  id="quotation-gstin"
                  className={styles.input}
                  type="text"
                  name="gstin"
                  autoComplete="off"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  disabled={isBusy}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                />
              </div>
            </div>
          </div>

          <div className={styles.section} aria-labelledby="quotation-section-address">
            <h3 className={styles.sectionTitle} id="quotation-section-address">
              Address
            </h3>
            <div>
              <label className={styles.label} htmlFor="quotation-address-title">
                Title
              </label>
              <input
                id="quotation-address-title"
                className={styles.input}
                type="text"
                name="addressTitle"
                autoComplete="off"
                value={addressTitle}
                onChange={(e) => setAddressTitle(e.target.value)}
                disabled={isBusy}
                placeholder="e.g. Office, Home, Site"
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="quotation-street">
                Street address
              </label>
              <input
                id="quotation-street"
                className={styles.input}
                type="text"
                name="streetAddress"
                autoComplete="street-address"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                disabled={isBusy}
                placeholder="Building, street, number"
              />
            </div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="quotation-area">
                  Area
                </label>
                <input
                  id="quotation-area"
                  className={styles.input}
                  type="text"
                  name="area"
                  autoComplete="address-level2"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  disabled={isBusy}
                  placeholder="Locality / area"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="quotation-landmark">
                  Landmark
                </label>
                <input
                  id="quotation-landmark"
                  className={styles.input}
                  type="text"
                  name="landmark"
                  autoComplete="off"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  disabled={isBusy}
                  placeholder="Nearby landmark"
                />
              </div>
            </div>
            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="quotation-pincode">
                  Pincode
                </label>
                <input
                  id="quotation-pincode"
                  className={styles.input}
                  type="text"
                  name="pincode"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  disabled={isBusy}
                  placeholder="Postal code"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="quotation-city">
                  City
                </label>
                <input
                  id="quotation-city"
                  className={styles.input}
                  type="text"
                  name="city"
                  autoComplete="address-level2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isBusy}
                  placeholder="City"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="quotation-state">
                  State
                </label>
                <input
                  id="quotation-state"
                  className={styles.input}
                  type="text"
                  name="state"
                  autoComplete="address-level1"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  disabled={isBusy}
                  placeholder="State / province"
                />
              </div>
            </div>
            <div>
              <label className={styles.label} htmlFor="quotation-country">
                Country
              </label>
              <input
                id="quotation-country"
                className={styles.input}
                type="text"
                name="country"
                autoComplete="country-name"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={isBusy}
                placeholder="India"
              />
            </div>
          </div>
        </div>

        {submitError ? <p className={styles.apiError}>{submitError}</p> : null}

        <div className={styles.actions}>
          <button type="button" className={styles.btnCancel} onClick={onClose} disabled={isBusy}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            aria-busy={isBusy}
          >
            {phase === "saving"
              ? "Saving your order..."
              : phase === "generating"
                ? "Generating your quotation..."
                : phase === "sending"
                  ? "Sending on WhatsApp..."
                  : "Confirm to Place Order"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof window !== "undefined" ? createPortal(content, document.body) : null;
}
