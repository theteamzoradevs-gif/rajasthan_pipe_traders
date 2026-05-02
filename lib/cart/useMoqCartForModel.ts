"use client";

import { useCallback, useMemo } from "react";
import { useCartWishlist } from "@/app/context/CartWishlistContext";
import { useLeadGate } from "@/app/context/LeadPhoneContext";
import type { AddCartItemInput } from "@/app/context/CartWishlistContext";
import { cartLineMatches } from "@/lib/cart/matchCartLine";
import { moqStepsFromPacketQty, packetsFromMoqSteps } from "@/lib/cart/packetLine";
import type { ListingMoqCartModel } from "@/lib/cart/listingMoqModel";

/** Minimum packets to satisfy both MOQ (packets) and MOQ (bags) when bulk pricing applies */
function effectiveMinPackets(model: ListingMoqCartModel, qpb: number, hasBulk: boolean): number {
  const moqP = Math.max(0, Math.floor(Number(model.moq) || 0));
  const moqB = Math.max(0, Math.floor(Number(model.moqBags) || 0));
  if (!hasBulk || qpb <= 0) return moqP;
  return Math.max(moqP, moqB * qpb);
}

function clampPositivePackets(nextPkt: number, minPkt: number): number {
  if (nextPkt <= 0) return 0;
  if (minPkt <= 0) return nextPkt;
  return Math.max(nextPkt, minPkt);
}

function basePayload(m: ListingMoqCartModel, orderMode: "packets" | "master_bag"): AddCartItemInput {
  return {
    productId: m.productId,
    mongoProductId: m.mongoProductId,
    categoryMongoId: m.categoryMongoId,
    productSlug: m.productSlug,
    productImage: m.productImage,
    productName: m.productName,
    brand: m.brand,
    category: m.category,
    sellerId: m.sellerId,
    sellerName: m.sellerName,
    size: m.size,
    pricePerUnit: m.pricePerUnit,
    basicPricePerUnit: m.basicPricePerUnit,
    qtyPerBag: m.qtyPerBag,
    pcsPerPacket: m.pcsPerPacket,
    orderMode,
  };
}

export function useMoqCartForModel(model: ListingMoqCartModel) {
  const { cartItems, addToCart, updateQuantity, removeFromCart } = useCartWishlist();
  const { withLead } = useLeadGate();
  const add = useCallback(
    (a: AddCartItemInput, b?: number) => {
      withLead(() => {
        addToCart(a, b);
      });
    },
    [withLead, addToCart]
  );

  const qpb = Math.max(0, Math.floor(Number(model.qtyPerBag) || 0));
  const hasBulk = qpb > 0;

  const bagQtyRaw = useMemo(() => {
    const line = cartItems.find((ci) =>
      cartLineMatches(ci, model.productId, model.size, model.sellerId, "master_bag")
    );
    return line ? Math.max(0, Math.floor(Number(line.quantity) || 0)) : 0;
  }, [cartItems, model.productId, model.size, model.sellerId]);

  const pktQtyRaw = useMemo(() => {
    const line = cartItems.find((ci) =>
      cartLineMatches(ci, model.productId, model.size, model.sellerId, "packets")
    );
    return line ? Math.max(0, Math.floor(Number(line.quantity) || 0)) : 0;
  }, [cartItems, model.productId, model.size, model.sellerId]);

  const pktQty = hasBulk && qpb > 0
    ? (pktQtyRaw > 0 ? pktQtyRaw : bagQtyRaw * qpb)
    : pktQtyRaw;
  const bagQty = hasBulk && qpb > 0 ? Math.floor(pktQty / qpb + 1e-9) : bagQtyRaw;
  const pktSteps = hasBulk ? moqStepsFromPacketQty(pktQty, qpb) : pktQty;

  const minPkt = useMemo(
    () => effectiveMinPackets(model, qpb, hasBulk),
    [model, qpb, hasBulk]
  );

  const setBagTarget = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (hasBulk && qpb > 0) {
        let nextPkt = next * qpb;
        nextPkt = clampPositivePackets(nextPkt, minPkt);
        if (nextPkt === 0) {
          removeFromCart(model.productId, model.size, model.sellerId, "packets");
          removeFromCart(model.productId, model.size, model.sellerId, "master_bag");
          return;
        }
        if (pktQtyRaw === 0) {
          add(basePayload(model, "packets"), nextPkt);
        } else {
          updateQuantity(model.productId, model.size, nextPkt, model.sellerId, "packets");
        }
        if (bagQtyRaw > 0) {
          removeFromCart(model.productId, model.size, model.sellerId, "master_bag");
        }
        return;
      }
      if (next === 0) {
        removeFromCart(model.productId, model.size, model.sellerId, "master_bag");
        return;
      }
      if (bagQtyRaw === 0) {
        add(basePayload(model, "master_bag"), next);
      } else {
        updateQuantity(model.productId, model.size, next, model.sellerId, "master_bag");
      }
    },
    [model, hasBulk, qpb, bagQtyRaw, pktQtyRaw, add, updateQuantity, removeFromCart]
  );

  const setPacketTarget = useCallback(
    (nextPkt: number) => {
      if (nextPkt < 0) return;
      const next = clampPositivePackets(nextPkt, minPkt);
      if (hasBulk && qpb > 0) {
        if (next === 0) {
          removeFromCart(model.productId, model.size, model.sellerId, "packets");
          removeFromCart(model.productId, model.size, model.sellerId, "master_bag");
          return;
        }
        if (pktQtyRaw === 0) {
          add(basePayload(model, "packets"), next);
        } else {
          updateQuantity(model.productId, model.size, next, model.sellerId, "packets");
        }
        if (bagQtyRaw > 0) {
          removeFromCart(model.productId, model.size, model.sellerId, "master_bag");
        }
        return;
      }
      if (next === 0) {
        removeFromCart(model.productId, model.size, model.sellerId, "packets");
        return;
      }
      if (pktQtyRaw === 0) {
        add(basePayload(model, "packets"), next);
      } else {
        updateQuantity(model.productId, model.size, next, model.sellerId, "packets");
      }
    },
    [model, hasBulk, qpb, pktQtyRaw, bagQtyRaw, minPkt, add, updateQuantity, removeFromCart]
  );

  const onBagDelta = useCallback((delta: number) => {
    setBagTarget(bagQty + delta);
  }, [bagQty, setBagTarget]);

  const onPacketDelta = useCallback(
    (delta: number) => {
      if (!hasBulk) {
        setPacketTarget(pktQty + delta);
        return;
      }
      setPacketTarget(Math.max(0, pktQty + delta * qpb));
    },
    [hasBulk, pktQty, qpb, setPacketTarget]
  );

  const setPacketStepsFromInput = useCallback(
    (n: number) => {
      if (Number.isNaN(n) || n < 0) return;
      if (!hasBulk) {
        setPacketTarget(n);
        return;
      }
      setPacketTarget(packetsFromMoqSteps(n, qpb));
    },
    [hasBulk, qpb, setPacketTarget]
  );

  return {
    hasBulk,
    qpb,
    bagQty,
    pktQty,
    pktSteps,
    setBagTarget,
    setPacketTarget,
    onBagDelta,
    onPacketDelta,
    setPacketStepsFromInput,
  };
}
