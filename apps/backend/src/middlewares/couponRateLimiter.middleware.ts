import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api';
import { CouponErrorCode } from '../utils/couponErrors';

const validateRequests = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT = 10; 
const WINDOW_MS = 60 * 1000;

export const couponValidateRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const key = req.user?.userId || req.ip || 'anonymous';
  const now = Date.now();
  let record = validateRequests.get(key);

  if (!record || now - record.lastReset > WINDOW_MS) {
    record = { count: 1, lastReset: now };
  } else {
    record.count++;
    if (record.count > RATE_LIMIT) {
        throw new ApiError(429,"Too many validation requests",{ coupon: [CouponErrorCode.RATE_LIMIT_EXCEEDED] })
    }
  }

  validateRequests.set(key, record);
  next();
};