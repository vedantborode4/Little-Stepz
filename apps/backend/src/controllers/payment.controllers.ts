import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../utils/api";
import {
  createPaymentBodySchema,
  verifyPaymentBodySchema,
  createCodPaymentBodySchema,
  createReturnBodySchema,
  trackOrderParamsSchema,
} from "@repo/zod-schema/index";
import {
  createPaymentService,
  verifyPaymentService,
  createCodPaymentService,
  handleRazorpayWebhookService,
  createReturnRequestService,
  trackOrderService,
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

async function createCodPayment(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const validated = createCodPaymentBodySchema.parse(req.body);
  const result    = await createCodPaymentService(userId, validated, req);

  return new ApiResponse(200, result, "COD order confirmed").send(res);
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

  res.status(200).json({ success: true, message: "Webhook received" });

  handleRazorpayWebhookService(rawBody, signature, payload).catch((err) => {
    console.error("[Webhook] Razorpay webhook processing failed:", err?.message);
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
export const createCodPaymentController = asyncHandler(createCodPayment);
export const razorpayWebhookController  = razorpayWebhook; // NOT wrapped in asyncHandler — responds 200 immediately
export const requestReturnController    = asyncHandler(requestReturn);
export const trackOrderController       = asyncHandler(trackOrder);