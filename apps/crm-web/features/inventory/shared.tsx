"use client"

import clsx from "clsx"
import type { StockBucket, StockDocumentType, StockState } from "@repo/crm-schema"
import { STOCK_BUCKET_LABELS, STOCK_DOCUMENT_TYPE_LABELS } from "@repo/crm-schema"
import { Badge, type BadgeTone } from "@/components/ui/Display"
import LinkTabs from "@/components/ui/Tabs"
import { formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"

const STATE_META: Record<StockState, { label: string; tone: BadgeTone }> = {
  OK: { label: "In stock", tone: "green" },
  LOW: { label: "Low stock", tone: "yellow" },
  OUT: { label: "Out of stock", tone: "red" },
}

const TYPE_TONES: Record<StockDocumentType, BadgeTone> = {
  OPENING: "blue",
  PURCHASE: "blue",
  SALE: "purple",
  SALE_RETURN: "green",
  PURCHASE_RETURN: "yellow",
  TRANSFER: "gray",
  BUCKET_MOVE: "gray",
  WRITE_OFF: "red",
  ADJUSTMENT: "yellow",
  REVERSAL: "gray",
}

const BUCKET_TONES: Record<StockBucket, BadgeTone> = { SELLABLE: "green", DAMAGED: "red", DEMO: "purple", QUARANTINE: "yellow" }

export const StockStateBadge = ({ state }: { state: StockState }) => <Badge tone={STATE_META[state].tone}>{STATE_META[state].label}</Badge>
export const DocTypeBadge = ({ type }: { type: StockDocumentType }) => (
  <Badge tone={TYPE_TONES[type]}>{STOCK_DOCUMENT_TYPE_LABELS[type]}</Badge>
)
export const BucketBadge = ({ bucket }: { bucket: StockBucket }) => <Badge tone={BUCKET_TONES[bucket]}>{STOCK_BUCKET_LABELS[bucket]}</Badge>

const INTERNAL_TYPES: StockDocumentType[] = ["TRANSFER", "BUCKET_MOVE"]

/**
 * Cost cell for a ledger line. Transfers and status changes have no cost effect,
 * so they show a dash; "Unknown" is kept for units whose cost was never recorded.
 */
export function LineCost({ unitCost, effectiveType }: { unitCost: string | null | undefined; effectiveType: StockDocumentType }) {
  if (INTERNAL_TYPES.includes(effectiveType)) {
    return (
      <span className="text-faint" title="Moves between locations or statuses don't change cost">
        —
      </span>
    )
  }
  return unitCost ? (
    <span className="tabular">{formatMoney(unitCost)}</span>
  ) : (
    <span className="text-yellow-700 dark:text-yellow-400">Unknown</span>
  )
}

/** Signed quantity: green for units in, red for units out. */
export function Qty({ value, className }: { value: number; className?: string }) {
  return (
    <span className={clsx("tabular font-semibold", value > 0 ? "text-green-600 dark:text-green-400" : "text-red-500", className)}>
      {value > 0 ? `+${value}` : value}
    </span>
  )
}

export function InventoryTabs() {
  const can = useCan()
  return (
    <LinkTabs
      tabs={[
        { label: "Stock levels", href: "/inventory", exact: true },
        { label: "Movements", href: "/inventory/movements" },
        ...(can("inventory.move") || can("inventory.adjust") ? [{ label: "Record movement", href: "/inventory/new" }] : []),
      ]}
    />
  )
}
