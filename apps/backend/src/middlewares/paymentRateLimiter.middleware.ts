import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api";
import { PaymentErrorCode } from "../utils/paymentErrors";


interface RateRecord {
  count:     number;
  windowStart: number;
}

const paymentAttempts = new Map<string, RateRecord>();
const verifyAttempts  = new Map<string, RateRecord>();
const codAttempts     = new Map<string, RateRecord>();

const PAYMENT_CREATE_LIMIT = 5;   // 5 payment creates per 10 minutes
const PAYMENT_VERIFY_LIMIT = 10;  // 10 verifications per 10 minutes
const COD_LIMIT            = 3;   // 3 COD orders per 10 minutes
const WINDOW_MS            = 10 * 60 * 1000; // 10 minutes

function checkRateLimit(
  map:     Map<string, RateRecord>,
  key:     string,
  limit:   number,
  windowMs: number
): void {
  const now    = Date.now();
  const record = map.get(key);

  if (!record || now - record.windowStart > windowMs) {
    map.set(key, { count: 1, windowStart: now });
    return;
  }

  record.count++;
  if (record.count > limit) {
    throw new ApiError(429, PaymentErrorCode.PAYMENT_MAX_ATTEMPTS, {
      value: [`Too many requests. Try again in a few minutes.`],
    });
  }

  map.set(key, record);
}

// Cleanup old entries periodically to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of paymentAttempts.entries()) {
    if (now - record.windowStart > WINDOW_MS * 2) paymentAttempts.delete(key);
  }
  for (const [key, record] of verifyAttempts.entries()) {
    if (now - record.windowStart > WINDOW_MS * 2) verifyAttempts.delete(key);
  }
  for (const [key, record] of codAttempts.entries()) {
    if (now - record.windowStart > WINDOW_MS * 2) codAttempts.delete(key);
  }
}, 5 * 60 * 1000); // Cleanup every 5 minutes

export const paymentCreateRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const key = req.user?.userId ?? req.ip ?? "anonymous";
  try {
    checkRateLimit(paymentAttempts, key, PAYMENT_CREATE_LIMIT, WINDOW_MS);
    next();
  } catch (err) {
    next(err);
  }
};

export const paymentVerifyRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const key = req.user?.userId ?? req.ip ?? "anonymous";
  try {
    checkRateLimit(verifyAttempts, key, PAYMENT_VERIFY_LIMIT, WINDOW_MS);
    next();
  } catch (err) {
    next(err);
  }
};

export const codPaymentRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const key = req.user?.userId ?? req.ip ?? "anonymous";
  try {
    checkRateLimit(codAttempts, key, COD_LIMIT, WINDOW_MS);
    next();
  } catch (err) {
    next(err);
  }
};
