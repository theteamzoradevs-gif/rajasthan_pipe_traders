"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./QtyRequiredPopup.module.css";

interface QtyRequiredPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QtyRequiredPopup({ isOpen, onClose }: QtyRequiredPopupProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.box}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="qty-hint-title"
      >
        <h2 id="qty-hint-title" className={styles.title}>
          Add pieces first
        </h2>
        <p className={styles.text}>
          Please Add product quantity first.
        </p>
        <button type="button" className={styles.okBtn} onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
