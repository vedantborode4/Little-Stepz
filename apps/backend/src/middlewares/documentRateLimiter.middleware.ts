import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api";
import { OrderErrorCode } from "../utils/orderErrors";

/**
 * Throttle invoice and receipt downloads.
 *
 * Deliberately its own bucket rather than `orderRateLimiter`: that one is shared with
 * order creation and payment verification, so five PDF downloads inside a minute would
 * 429 a following `booking/verify` and leave a captured Razorpay payment unconfirmed.
 * Rendering a PDF is not free either, so these are bounded — just separately, and more
 * loosely than a write.
 */
const documentRequests = new Map<string, { count: number; lastReset: number }>();
const DOCUMENT_RATE_LIMIT = 20; // 20 downloads per minute per user/IP
const WINDOW_MS = 60 * 1000;

export const documentRateLimiter = (req: Request, _res: Response, next: NextFunction) => {
  const key = req.user?.userId || req.ip || "anonymous";
  const now = Date.now();
  let record = documentRequests.get(key);

  if (!record || now - record.lastReset > WINDOW_MS) {
    record = { count: 1, lastReset: now };
  } else {
    record.count++;
    if (record.count > DOCUMENT_RATE_LIMIT) {
      throw new ApiError(429, OrderErrorCode.RATE_LIMIT_EXCEEDED, {
        value: ["Too many document downloads"],
      });
    }
  }

  documentRequests.set(key, record);
  next();
};
