"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useCartWishlist } from "@/app/context/CartWishlistContext";
import LeadPhoneModal from "@/app/components/LeadPhoneModal/LeadPhoneModal";
import { getStoredLeadPhone, setStoredLeadPhone } from "@/lib/lead/leadStorage";
import { serializeItemsForLead } from "@/lib/lead/serializeItemsForLead";

type LeadContextValue = {
  /** Run the action; if no phone in localStorage, the modal is shown and the action runs after save. */
  withLead: (action: () => void) => void;
};

const LeadContext = createContext<LeadContextValue | null>(null);

async function postLead(phone: string, items: ReturnType<typeof serializeItemsForLead>) {
  try {
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, itemsInCart: items }),
    });
  } catch {
    /* non-blocking */
  }
}

export function LeadPhoneProvider({ children }: { children: React.ReactNode }) {
  const { cartItems } = useCartWishlist();
  const cartRef = useRef(cartItems);
  useEffect(() => {
    cartRef.current = cartItems;
  }, [cartItems]);

  const [modalOpen, setModalOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);

  const scheduleSync = useCallback((phone: string) => {
    setTimeout(() => {
      void postLead(phone, serializeItemsForLead(cartRef.current));
    }, 80);
  }, []);

  const withLead = useCallback(
    (action: () => void) => {
      const p = getStoredLeadPhone();
      if (p) {
        action();
        return;
      }
      pendingRef.current = action;
      setModalOpen(true);
    },
    []
  );

  const onCancel = useCallback(() => {
    setModalOpen(false);
    pendingRef.current = null;
  }, []);

  const onConfirm = useCallback(
    (phone: string) => {
      setStoredLeadPhone(phone);
      setModalOpen(false);
      const fn = pendingRef.current;
      pendingRef.current = null;
      if (fn) {
        fn();
        scheduleSync(phone);
      }
    },
    [scheduleSync]
  );

  // Keep lead cart snapshot in sync when phone is known and cart changes
  useEffect(() => {
    const p = getStoredLeadPhone();
    if (!p) return;
    const t = setTimeout(() => {
      void postLead(p, serializeItemsForLead(cartItems));
    }, 500);
    return () => clearTimeout(t);
  }, [cartItems]);

  return (
    <LeadContext.Provider value={{ withLead }}>
      {children}
      <LeadPhoneModal isOpen={modalOpen} onConfirm={onConfirm} onCancel={onCancel} />
    </LeadContext.Provider>
  );
}

export function useLeadGate(): LeadContextValue {
  const c = useContext(LeadContext);
  if (!c) {
    return { withLead: (action: () => void) => action() };
  }
  return c;
}
