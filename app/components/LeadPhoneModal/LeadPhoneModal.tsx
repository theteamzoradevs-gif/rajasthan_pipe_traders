"use client";

import React, { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./LeadPhoneModal.module.css";
const PHONE_OK = /^\d{10}$/;

function digitsOnly(s: string, max: number) {
  return s.replace(/\D/g, "").slice(0, max);
}

interface LeadPhoneModalProps {
  isOpen: boolean;
  onConfirm: (phone: string) => void;
  onCancel: () => void;
}

export default function LeadPhoneModal({ isOpen, onConfirm, onCancel }: LeadPhoneModalProps) {
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const id = useId();

  const valid = PHONE_OK.test(phone);
  const showErr = touched && phone.length > 0 && !valid;
  const canSubmit = valid;

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(digitsOnly(e.target.value, 10));
  }, []);

  const submit = useCallback(() => {
    if (!canSubmit) return;
    onConfirm(phone);
    setPhone("");
    setTouched(false);
  }, [canSubmit, onConfirm, phone]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const body = (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className={styles.card}>
        <h2 className={styles.title} id={id}>
          Enter your phone number to proceed
        </h2>
        <p className={styles.sub}>We use this to save your cart and help you checkout faster.</p>
        <label className={styles.label} htmlFor="lead-phone">
          Mobile number (10 digits)
        </label>
        <input
          id="lead-phone"
          className={styles.input + (showErr ? " " + styles.inputInvalid : "")}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={onChange}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) submit();
          }}
          placeholder="e.g. 9876543210"
        />
        <p className={styles.err}>{showErr ? "Enter a valid 10-digit mobile number" : ""}</p>
        <div className={styles.btnRow}>
          <button type="button" className={styles.btn} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btn + " " + styles.btnPrimary}
            disabled={!canSubmit}
            onClick={submit}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(body, document.body) : null;
}
