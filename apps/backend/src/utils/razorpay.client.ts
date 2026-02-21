import crypto from "crypto";
import { ApiError } from "../utils/api";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function getAuthHeader(): string {
  const keyId     = process.env.RAZORPAY_KEY_ID!;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  }
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function razorpayRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${RAZORPAY_API}${path}`, {
    method,
    headers: {
      Authorization:  getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json() as any;

  if (!res.ok) {
    const errMsg = data?.error?.description || "Razorpay API error";
    throw new ApiError(502, errMsg);
  }

  return data as T;
}

export interface RazorpayOrder {
  id:          string;
  entity:      string;
  amount:      number; // in paise
  currency:    string;
  status:      string;
  receipt:     string;
  notes:       Record<string, string>;
  created_at:  number;
}

export interface RazorpayRefund {
  id:         string;
  entity:     string;
  amount:     number; // in paise
  currency:   string;
  payment_id: string;
  status:     string;
  created_at: number;
}

export async function createRazorpayOrder(params: {
  amount:   number; // in rupees — we convert to paise here
  currency: string;
  receipt:  string; // our internal order ID (max 40 chars)
  notes?:   Record<string, string>;
}): Promise<RazorpayOrder> {
  return razorpayRequest<RazorpayOrder>("POST", "/orders", {
    amount:   Math.round(params.amount * 100), // convert to paise
    currency: params.currency,
    receipt:  params.receipt.substring(0, 40),
    notes:    params.notes ?? {},
  });
}

export function verifyRazorpaySignature(params: {
  razorpayOrderId:   string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  const body      = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;
  const expected  = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(params.razorpaySignature, "hex")
  );
}

export function verifyRazorpayWebhookSignature(
  rawBody:   Buffer,
  signature: string
): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  if (!webhookSecret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET must be set");
  }
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature,  "hex")
    );
  } catch {
    // If signature is not valid hex, timingSafeEqual throws
    return false;
  }
}

export async function initiateRazorpayRefund(params: {
  paymentId: string;
  amount:    number; // in rupees
  notes?:    Record<string, string>;
}): Promise<RazorpayRefund> {
  return razorpayRequest<RazorpayRefund>(
    "POST",
    `/payments/${params.paymentId}/refund`,
    {
      amount: Math.round(params.amount * 100), // paise
      notes:  params.notes ?? {},
    }
  );
}

export async function fetchRazorpayPayment(paymentId: string): Promise<{
  id:       string;
  order_id: string;
  amount:   number;
  status:   string;
  captured: boolean;
}> {
  return razorpayRequest("GET", `/payments/${paymentId}`);
}
