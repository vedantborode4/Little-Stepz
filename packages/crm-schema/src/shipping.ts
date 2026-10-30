import { z } from "zod";
import { includeInactiveQuery, isoDate, listQuery, money, optionalFilterId, optionalText, requiredText } from "./common";

export const SHIPMENT_STATUSES = [
  "PENDING",
  "PACKED",
  "DISPATCHED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "RTO",
  "RETURNED",
  "CANCELLED",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];
export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "To pack",
  PACKED: "Packed",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  RTO: "Returning to us (RTO)",
  RETURNED: "Back with us",
  CANCELLED: "Cancelled",
};
/** Statuses after which a shipment is finished; an order can then get a new one. */
export const CLOSED_SHIPMENT_STATUSES: readonly ShipmentStatus[] = ["DELIVERED", "RETURNED", "CANCELLED"];

/** Allowed moves. Status is entered by hand from the courier's own tracking; nothing is fetched live. */
export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  PENDING: ["PACKED", "DISPATCHED", "CANCELLED"],
  PACKED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "RTO"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "RTO"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RTO"],
  DELIVERED: [],
  RTO: ["RETURNED"],
  RETURNED: [],
  CANCELLED: [],
};

const trackingTemplate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(
    z
      .string()
      .url("Enter a full link, e.g. https://www.delhivery.com/track/package/{awb}")
      .refine((v) => v.includes("{awb}"), "Put {awb} where the tracking number goes")
      .nullable(),
  )
  .nullish();

const courierFields = {
  name: requiredText(60),
  trackingUrlTemplate: trackingTemplate,
  phone: optionalText(20),
  notes: optionalText(500),
  isActive: z.boolean(),
};

export const createCourierSchema = z.object({ ...courierFields, isActive: courierFields.isActive.default(true) });
export type CreateCourierInput = z.infer<typeof createCourierSchema>;
export const updateCourierSchema = z.object(courierFields).partial();
export type UpdateCourierInput = z.infer<typeof updateCourierSchema>;

const awb = z
  .string()
  .trim()
  .toUpperCase()
  .min(4, "Enter the AWB / tracking number")
  .max(40)
  .regex(/^[A-Z0-9-]+$/, "Letters, digits and dashes only");

const optionalWeight = z
  .union([z.literal(""), z.null(), z.coerce.number().positive("Must be more than 0").max(1000)])
  .transform((v) => (v === "" || v === null ? null : v))
  .optional();

export const packageSchema = z.object({ awb, weightKg: optionalWeight, notes: optionalText(200) });
export type PackageInput = z.infer<typeof packageSchema>;

const optionalCourier = z
  .union([z.literal(""), z.string().uuid()])
  .transform((v) => (v === "" ? null : v))
  .nullish();

export const createShipmentSchema = z.object({
  orderId: z.string().uuid(),
  courierId: optionalCourier,
  /** What the courier charges us (an order-linked cost, separate from shipping charged to the customer). */
  courierCost: money.default("0"),
  notes: optionalText(500),
  packages: z.array(packageSchema).max(20).default([]),
});
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

export const updateShipmentSchema = z.object({
  courierId: optionalCourier,
  courierCost: money.optional(),
  notes: optionalText(500),
});
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;

export const shipmentStatusSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES),
  note: optionalText(300),
});
export type ShipmentStatusInput = z.infer<typeof shipmentStatusSchema>;

export const shipmentListQuery = listQuery.extend({
  status: z.enum(SHIPMENT_STATUSES).optional(),
  courierId: optionalFilterId,
  /** Open shipments only (not delivered, returned or cancelled). */
  open: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type ShipmentListQuery = z.infer<typeof shipmentListQuery>;

export const courierListQuery = includeInactiveQuery;
