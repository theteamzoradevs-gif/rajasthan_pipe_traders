"use client";

import React from "react";
import type { PackingUnitLabels } from "@/app/data/products";
import { useMoqCartForModel } from "@/lib/cart/useMoqCartForModel";
import type { ListingMoqCartModel } from "@/lib/cart/listingMoqModel";
import styles from "./ListingMoqCartControls.module.css";

export type { ListingMoqCartModel };
export { listingEntryToModel } from "@/lib/cart/listingMoqModel";

export type MoqCartControlsApi = ReturnType<typeof useMoqCartForModel>;

interface ListingMoqCartControlsViewProps {
  labels: PackingUnitLabels;
  moq: MoqCartControlsApi;
  className?: string;
  compact?: boolean;
  stackRows?: boolean;
  labelOuter?: string;
  labelInner?: string;
  labelSingle?: string;
  /**
   * Storefront product cards and product detail: use the same `stepperCardListing` row(s)
   * (− value +, unit chip) instead of the wide `ORDER BY` / `detailPage` steppers.
   */
  cardListingLayout?: boolean;
  /** Category cards: captions above each bulk row + equal-width bag/packet steppers. */
  labeledBulkCardRows?: boolean;
}

/** Presentational MOQ steppers; pass `moq` from `useMoqCartForModel` (e.g. product detail shares state with summary). */
export function ListingMoqCartControlsView({
  labels,
  moq,
  className,
  compact = false,
  stackRows = false,
  labelOuter,
  labelInner,
  labelSingle,
  cardListingLayout = false,
  labeledBulkCardRows = false,
}: ListingMoqCartControlsViewProps) {
  const {
    hasBulk,
    qpb,
    bagQty,
    pktQty,
    onBagDelta,
    onPacketDelta,
    setPacketStepsFromInput,
    setPacketTarget,
    setBagTarget,
  } = moq;

  const outerRowText = labelOuter ?? labels.outer;
  const innerRowText = labelInner ?? labels.innerHeading;
  const singleRowText = labelSingle ?? labels.innerHeading;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onPacketInput = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0) return;
    setPacketTarget(n);
  };

  const onBagInput = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0) return;
    setBagTarget(n);
  };

  return (
    <div
      className={`${styles.root} ${compact ? styles.compact : ""} ${stackRows ? styles.stackRows : ""} ${cardListingLayout ? styles.cardListingLayout : ""} ${labeledBulkCardRows ? styles.labeledBulkRows : ""} ${className ?? ""}`}
      onClick={stop}
    >
      {hasBulk ? (
        <>
          <div className={styles.bulkRows}>
            {cardListingLayout ? (
              labeledBulkCardRows ? (
                <>
                  <div className={styles.cardListingLabeledRow}>
                    <span className={styles.cardListingRowCap}>{labels.outerHeading}</span>
                    <div className={styles.cardListingOuterBox}>
                      <div className={`${styles.stepper} ${styles.stepperCardListing}`}>
                        <button type="button" className={styles.stepBtn} disabled={bagQty <= 0} onClick={(e) => { stop(e); onBagDelta(-1); }} aria-label={`Decrease ${labels.outerPlural}`}>
                          −
                        </button>
                        <input
                          type="number"
                          className={styles.stepInput}
                          value={bagQty}
                          min={0}
                          onChange={(e) => onBagInput(e.target.value)}
                          onClick={stop}
                          onFocus={(e) => e.currentTarget.select()}
                          aria-label={`${labels.outerHeading} quantity in ${labels.outerPlural}`}
                        />
                        <button type="button" className={styles.stepBtn} onClick={(e) => { stop(e); onBagDelta(1); }} aria-label={`Increase ${labels.outerPlural}`}>
                          +
                        </button>
                        <span className={styles.cardListingUnitChip}>{labels.outerPlural}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.cardListingLabeledRow}>
                    <span className={styles.cardListingRowCap}>{labels.innerHeading}</span>
                    <div className={styles.cardListingOuterBox}>
                      <div className={`${styles.stepper} ${styles.stepperCardListing}`}>
                        <button
                          type="button"
                          className={styles.stepBtn}
                          disabled={pktQty <= 0}
                          onClick={(e) => {
                            stop(e);
                            onPacketDelta(-1);
                          }}
                          aria-label="Decrease packet MOQ step"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          className={styles.stepInput}
                          value={pktQty}
                          min={0}
                          onChange={(e) => onPacketInput(e.target.value)}
                          onClick={stop}
                          onFocus={(e) => e.currentTarget.select()}
                          aria-label={`${labels.innerHeading} quantity in ${labels.innerPlural} (adds ${qpb} per click)`}
                        />
                        <button type="button" className={styles.stepBtn} onClick={(e) => { stop(e); onPacketDelta(1); }} aria-label="Increase packet MOQ step">
                          +
                        </button>
                        <span className={styles.cardListingUnitChip}>{labels.innerPlural}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
              <>
                <div className={styles.cardListingOuterBox}>
                  <div className={`${styles.stepper} ${styles.stepperCardListing}`}>
                    <button type="button" className={styles.stepBtn} disabled={bagQty <= 0} onClick={(e) => { stop(e); onBagDelta(-1); }} aria-label={`Decrease ${labels.outerPlural}`}>
                      −
                    </button>
                    <span className={styles.stepValue} aria-live="polite">
                      {bagQty}
                    </span>
                    <button type="button" className={styles.stepBtn} onClick={(e) => { stop(e); onBagDelta(1); }} aria-label={`Increase ${labels.outerPlural}`}>
                      +
                    </button>
                    <span className={styles.cardListingUnitChip}>{labels.outerPlural}</span>
                  </div>
                </div>
                <div className={styles.cardListingOuterBox}>
                  <div className={`${styles.stepper} ${styles.stepperCardListing}`}>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      disabled={pktQty <= 0}
                      onClick={(e) => {
                        stop(e);
                        onPacketDelta(-1);
                      }}
                      aria-label="Decrease packet MOQ step"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className={styles.stepInput}
                      value={pktQty}
                      min={0}
                      onChange={(e) => onPacketInput(e.target.value)}
                      onClick={stop}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label={`${labels.innerHeading} quantity in ${labels.innerPlural} (adds ${qpb} per click)`}
                    />
                    <button type="button" className={styles.stepBtn} onClick={(e) => { stop(e); onPacketDelta(1); }} aria-label="Increase packet MOQ step">
                      +
                    </button>
                    <span className={styles.cardListingUnitChip}>{labels.innerPlural}</span>
                  </div>
                </div>
              </>
            )
            ) : (
              <>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>{outerRowText}</span>
                  <div className={styles.stepper}>
                    <button type="button" className={styles.stepBtn} disabled={bagQty <= 0} onClick={(e) => { stop(e); onBagDelta(-1); }} aria-label={`Decrease ${labels.outerPlural}`}>
                      −
                    </button>
                    <span className={styles.stepValue} aria-live="polite">
                      {bagQty}
                    </span>
                    <button type="button" className={styles.stepBtn} onClick={(e) => { stop(e); onBagDelta(1); }} aria-label={`Increase ${labels.outerPlural}`}>
                      +
                    </button>
                    <span className={styles.unit}>{labels.outerPlural}</span>
                  </div>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>{innerRowText}</span>
                  <div className={styles.stepper}>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      disabled={pktQty <= 0}
                      onClick={(e) => {
                        stop(e);
                        onPacketDelta(-1);
                      }}
                      aria-label="Decrease packet MOQ step"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className={styles.stepInput}
                      value={pktQty}
                      min={0}
                      onChange={(e) => onPacketInput(e.target.value)}
                      onClick={stop}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label={`${labels.innerHeading} quantity in ${labels.innerPlural} (adds ${qpb} per click)`}
                    />
                    <button type="button" className={styles.stepBtn} onClick={(e) => { stop(e); onPacketDelta(1); }} aria-label="Increase packet MOQ step">
                      +
                    </button>
                    <span className={styles.unit}>{labels.innerPlural}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      ) : cardListingLayout ? (
        <div className={styles.cardListingOuterBox}>
          <div className={`${styles.stepper} ${styles.stepperCardListing}`}>
            <button type="button" className={styles.stepBtn} disabled={pktQty <= 0} onClick={(e) => { stop(e); onPacketDelta(-1); }} aria-label="Decrease quantity">
              −
            </button>
            <input
              type="number"
              className={styles.stepInput}
              value={pktQty}
              min={0}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n) && n >= 0) setPacketStepsFromInput(n);
              }}
              onClick={stop}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={`Quantity in ${labels.innerPlural}`}
            />
            <button type="button" className={styles.stepBtn} onClick={(e) => { stop(e); onPacketDelta(1); }} aria-label="Increase quantity">
              +
            </button>
            <span className={styles.cardListingUnitChip}>{labels.innerPlural}</span>
          </div>
        </div>
      ) : (
        <div className={styles.row}>
          <span className={styles.rowLabel}>{singleRowText}</span>
          <div className={styles.stepper}>
            <button type="button" className={styles.stepBtn} disabled={pktQty <= 0} onClick={(e) => { stop(e); onPacketDelta(-1); }} aria-label="Decrease quantity">
              −
            </button>
            <input
              type="number"
              className={styles.stepInput}
              value={pktQty}
              min={0}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n) && n >= 0) setPacketStepsFromInput(n);
              }}
              onClick={stop}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={`Quantity in ${labels.innerPlural}`}
            />
            <button type="button" className={styles.stepBtn} onClick={(e) => { stop(e); onPacketDelta(1); }} aria-label="Increase quantity">
              +
            </button>
            <span className={styles.unit}>{labels.innerPlural}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ListingMoqCartControlsProps extends Omit<ListingMoqCartControlsViewProps, "moq"> {
  model: ListingMoqCartModel;
}

export default function ListingMoqCartControls({ model, ...rest }: ListingMoqCartControlsProps) {
  const moq = useMoqCartForModel(model);
  return <ListingMoqCartControlsView {...rest} moq={moq} />;
}
