"use client";

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './OrderSuccessPopup.module.css';
import { CartItem } from '../../../context/CartWishlistContext';
import { pricedPacketCount } from '@/lib/cart/packetLine';
import { useStorefrontAppSettings } from '@/lib/useStorefrontAppSettings';

interface OrderSuccessPopupProps {
  isOpen: boolean;
  items: CartItem[];
  total: number;
  onClose: () => void;
  onContinue: () => void;
}

export default function OrderSuccessPopup({
  isOpen,
  items,
  total,
  onClose,
  onContinue,
}: OrderSuccessPopupProps) {
  const { pricesEffectiveDate } = useStorefrontAppSettings();

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Success icon */}
        <div className={styles.iconWrap}>
          <div className={styles.circle}>
            <svg className={styles.check} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h2 className={styles.title}>Order Request Placed!</h2>
        <p className={styles.subtitle}>
          Your order request has been received. Our team will contact you shortly.
        </p>

        {/* Items summary */}
        <div className={styles.summaryBox}>
          <div className={styles.summaryHeader}>
            <span>{items.length} item{items.length !== 1 ? 's' : ''} ordered</span>
            <span className={styles.summaryTotal}>₹{total.toFixed(2)}</span>
          </div>
          <ul className={styles.itemList}>
            {items.slice(0, 3).map((item, i) => (
              <li key={i} className={styles.itemRow}>
                <span className={styles.itemName}>{item.productName}</span>
                <span className={styles.itemMeta}>
                  {item.size} · {pricedPacketCount(item)} pkt
                </span>
              </li>
            ))}
            {items.length > 3 && (
              <li className={styles.moreItems}>+{items.length - 3} more items</li>
            )}
          </ul>
        </div>

        <p className={styles.paymentNote}>
          100% advance payment
          {pricesEffectiveDate ? ` · Prices effective ${pricesEffectiveDate}` : ""}
        </p>

        {/* Button */}
        <div className={styles.actions}>
          <button className={styles.continueBtn} onClick={onContinue}>
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(content, document.body) : null;
}
