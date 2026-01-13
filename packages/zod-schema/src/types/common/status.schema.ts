import { z } from "zod";

export const orderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

export const paymentStatusSchema = z.enum([
  "PENDING",
  "SUCCESS",
  "FAILED",
]);

export const commissionStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "PAID",
]);
