import { Request, Response } from "express";
import crypto from "crypto";
import { asyncHandler, ApiError, ApiResponse } from "../utils/api";
import {
  createPaymentBodySchema,
  verifyPaymentBodySchema,
  createReturnBodySchema,
  trackOrderParamsSchema,
} from "@repo/zod-schema/index";
import {
  createPaymentService,
  verifyPaymentService,
  handleRazorpayWebhookService,
  createReturnRequestService,
  trackOrderService,
  handleDelhiveryWebhookService,
} from "../services/payment.services";
import { verifyRazorpayWebhookSignature } from "../utils/razorpay.client";
import { PaymentErrorCode } from "../utils/paymentErrors";
import { orderParamsSchema } from "@repo/zod-schema/index";

async function createPayment(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const validated = createPaymentBodySchema.parse(req.body);
  const result    = await createPaymentService(userId, validated, req);

  return new ApiResponse(200, result, "Payment initiated").send(res);
}

async function verifyPayment(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const validated = verifyPaymentBodySchema.parse(req.body);
  const result    = await verifyPaymentService(userId, validated, req);

  return new ApiResponse(200, result, "Payment verified successfully").send(res);
}

/**
 * Cash on Delivery has been withdrawn as a payment method.
 *
 * 410 rather than a deleted route: published mobile builds still offer the COD
 * button, and they map error codes to copy. A 404 would surface as a generic
 * failure with the order left PENDING and no explanation.
 */
async function codRetired(_req: Request, _res: Response) {
  throw new ApiError(410, PaymentErrorCode.COD_NOT_AVAILABLE);
}

async function razorpayWebhook(req: Request, res: Response) {
  const signature = req.headers["x-razorpay-signature"] as string;

  if (!signature) {
    return res.status(400).json({ success: false, message: "Missing signature" });
  }

  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ success: false, message: "Invalid body format" });
  }

  let isValid: boolean;
  try {
    isValid = verifyRazorpayWebhookSignature(rawBody, signature);
  } catch (err: any) {
    return res.status(400).json({ success: false, message: "Signature verification failed" });
  }

  if (!isValid) {
    return res
      .status(400)
      .json({ success: false, message: PaymentErrorCode.WEBHOOK_SIGNATURE_INVALID });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false, message: "Invalid JSON payload" });
  }

  // Processed BEFORE responding. Replying 200 first and handling in the background
  // meant a failure was logged and lost: Razorpay only retries a non-2xx, so a
  // payment that failed to apply was never retried and the order stayed unpaid.
  // Handling is idempotent (WebhookEvent unique on provider+eventId, and every
  // handler re-asserts state), so a retry is always safe.
  try {
    const result = await handleRazorpayWebhookService(rawBody, signature, payload);
    return res.status(200).json({ success: true, message: result.message });
  } catch (err: any) {
    console.error("[Webhook] Razorpay webhook processing failed:", err?.message);
    // Non-2xx so Razorpay retries. The event is left FAILED and reclaimed on retry.
    return res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
}

// Constant-time comparison so a wrong-but-same-length token can't be probed by timing.
function safeEqual(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Delhivery pushes status updates but does not sign webhooks — guard with a shared secret
// passed as ?token= or the x-delhivery-token header, matched against DELHIVERY_WEBHOOK_TOKEN.
function delhiveryWebhook(req: Request, res: Response) {
  const expected = process.env.DELHIVERY_WEBHOOK_TOKEN;
  const provided =
    (req.query.token as string | undefined) ?? (req.headers["x-delhivery-token"] as string | undefined);

  if (!safeEqual(provided, expected)) {
    return res.status(401).json({ success: false, message: "Unauthorized webhook" });
  }

  const payload = req.body;
  res.status(200).json({ success: true, message: "Webhook received" });

  handleDelhiveryWebhookService(payload).catch((err) => {
    console.error("[Webhook] Delhivery webhook processing failed:", err?.message);
  });
}

async function requestReturn(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { id: orderId } = orderParamsSchema.parse(req.params);
  const validated       = createReturnBodySchema.parse(req.body);
  const result          = await createReturnRequestService(userId, orderId, validated, req);

  return new ApiResponse(200, result, "Return request submitted").send(res);
}


async function trackOrder(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { id: orderId } = trackOrderParamsSchema.parse(req.params);
  const result          = await trackOrderService(userId, orderId);

  return new ApiResponse(200, result, "Tracking info fetched").send(res);
}


export const createPaymentController    = asyncHandler(createPayment);
export const verifyPaymentController    = asyncHandler(verifyPayment);
export const codRetiredController       = asyncHandler(codRetired);
export const razorpayWebhookController  = razorpayWebhook; // NOT wrapped in asyncHandler — responds 200 immediately
export const delhiveryWebhookController  = delhiveryWebhook; // responds 200 immediately, processes async
export const requestReturnController    = asyncHandler(requestReturn);
export const trackOrderController       = asyncHandler(trackOrder);