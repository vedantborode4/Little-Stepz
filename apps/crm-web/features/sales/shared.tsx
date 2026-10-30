"use client"

import {
  PRICE_SOURCE_LABELS,
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_TYPE_LABELS,
  type PriceSource,
  type SalesOrderStatus,
  type SalesOrderType,
} from "@repo/crm-schema"
import { Badge, type BadgeTone } from "@/components/ui/Display"

const STATUS_TONES: Record<SalesOrderStatus, BadgeTone> = {
  DRAFT: "yellow",
  CONFIRMED: "blue",
  PACKED: "purple",
  DISPATCHED: "purple",
  DELIVERED: "green",
  COMPLETED: "green",
  CANCELLED: "gray",
}

export const OrderStatusBadge = ({ status }: { status: SalesOrderStatus }) => (
  <Badge tone={STATUS_TONES[status]}>{SALES_ORDER_STATUS_LABELS[status]}</Badge>
)

export const OrderTypeBadge = ({ type }: { type: SalesOrderType }) =>
  type === "PRE_ORDER" ? <Badge tone="purple">{SALES_ORDER_TYPE_LABELS[type]}</Badge> : null

/** Regular price needs no badge; anything else explains why the price differs. */
export const PriceSourceBadge = ({ source }: { source: PriceSource }) =>
  source === "REGULAR" ? null : <Badge tone={source === "MANUAL" ? "yellow" : "green"}>{PRICE_SOURCE_LABELS[source]}</Badge>
