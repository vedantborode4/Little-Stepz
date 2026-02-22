import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api";
import { AffiliateErrorCode } from "../utils/affiliateErrors";


interface WindowRecord {
  minuteCount:     number;
  minuteStart:     number;
  hourCount:       number;
  hourStart:       number;
}

const MINUTE_LIMIT = 10;
const HOUR_LIMIT   = 100;
const MINUTE_MS    = 60 * 1000;
const HOUR_MS      = 60 * 60 * 1000;

const clickWindows = new Map<string, WindowRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of clickWindows.entries()) {
    if (now - record.hourStart > HOUR_MS * 2) {
      clickWindows.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function referralClickRateLimiter(
  req:  Request,
  res:  Response,
  next: NextFunction
): void {
  const ip  = req.ip ?? req.socket?.remoteAddress ?? "unknown";
  const now = Date.now();

  let record = clickWindows.get(ip);

  if (!record) {
    record = {
      minuteCount: 0,
      minuteStart: now,
      hourCount:   0,
      hourStart:   now,
    };
  }

  // Reset minute window if expired
  if (now - record.minuteStart > MINUTE_MS) {
    record.minuteCount = 0;
    record.minuteStart = now;
  }

  // Reset hour window if expired
  if (now - record.hourStart > HOUR_MS) {
    record.hourCount = 0;
    record.hourStart = now;
  }

  record.minuteCount++;
  record.hourCount++;
  clickWindows.set(ip, record);

  if (record.minuteCount > MINUTE_LIMIT || record.hourCount > HOUR_LIMIT) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({
      success: false,
      message: AffiliateErrorCode.CLICK_RATE_LIMITED,
    });
    return;
  }

  next();
}


const withdrawalAttempts = new Map<string, { count: number; windowStart: number }>();
const WITHDRAWAL_LIMIT   = 3;
const DAY_MS             = 24 * 60 * 60 * 1000;

export function withdrawalRateLimiter(
  req:  Request,
  res:  Response,
  next: NextFunction
): void {
  const key = req.user?.userId ?? req.ip ?? "anonymous";
  const now = Date.now();

  let record = withdrawalAttempts.get(key);

  if (!record || now - record.windowStart > DAY_MS) {
    record = { count: 1, windowStart: now };
  } else {
    record.count++;
    if (record.count > WITHDRAWAL_LIMIT) {
      res.setHeader("Retry-After", "86400");
      next(new ApiError(429, "Too many withdrawal requests. Max 3 per day."));
      return;
    }
  }

  withdrawalAttempts.set(key, record);
  next();
}
