"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./WhatsAppPopup.module.css";

const STORAGE_KEY = "rpt_customer_phone";

interface WhatsAppPopupProps {
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
}

export default function WhatsAppPopup({ isOpen, onClose, productName }: WhatsAppPopupProps) {
  const [phone, setPhone]       = useState("");
  const [error, setError]       = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem(STORAGE_KEY);
      setSavedPhone(stored);

      if (stored) {
        /* Already have a number — skip form, go straight to success */
        setSubmitted(true);
      } else {
        setPhone("");
        setError("");
        setSubmitted(false);
        setTimeout(() => inputRef.current?.focus(), 150);
      }

      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  /* Auto-close after 2 s when in success state */
  useEffect(() => {
    if (!submitted || !isOpen) return;
    const t = setTimeout(onClose, 2000);
    return () => clearTimeout(t);
  }, [submitted, isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const validatePhone = (value: string) => value.replace(/\D/g, "").length === 10;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (!digits) { setError("Please enter your mobile number"); return; }
    if (!validatePhone(phone)) { setError("Please enter a valid 10-digit mobile number"); return; }

    localStorage.setItem(STORAGE_KEY, digits);
    setSavedPhone(digits);
    setSubmitted(true);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
    setPhone(val);
    if (error) setError("");
  };

  /* Allow user to change their saved number */
  const handleChangeNumber = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedPhone(null);
    setSubmitted(false);
    setPhone("");
    setError("");
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  if (!isOpen) return null;

  const content = (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.popup}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {!submitted ? (
          <>
            <div className={styles.iconWrap}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
            </div>

            {productName && <p className={styles.productTag}>{productName}</p>}
            <p className={styles.desc}>Enter your mobile number to confirm your order.</p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <span className={styles.prefix}>+91</span>
                <input
                  ref={inputRef}
                  type="tel"
                  inputMode="numeric"
                  placeholder="Enter 10-digit number"
                  value={phone}
                  onChange={handlePhoneChange}
                  className={`${styles.input} ${error ? styles.inputError : ""}`}
                  autoComplete="tel"
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.submitBtn}>
                Confirm
              </button>
            </form>

            <p className={styles.privacy}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Saved locally · never shared
            </p>
          </>
        ) : (
          <div className={styles.success}>
            <div className={styles.successIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7 9 18l-5-5" />
              </svg>
            </div>
            <h2 className={styles.title}>Thanks!</h2>
            <p className={styles.desc}>
              {productName
                ? <><strong>{productName}</strong> has been added to your cart.</>
                : <>Product has been added to your cart.</>}
            </p>
            {savedPhone && (
              <p className={styles.savedNote}>
                Order linked to +91 {savedPhone}
                <button className={styles.changeNumBtn} onClick={handleChangeNumber}>
                  Change
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
