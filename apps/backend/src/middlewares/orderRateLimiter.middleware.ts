import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api";
import { OrderErrorCode } from "../utils/orderErrors";

const orderRequests = new Map<string, { count: number; lastReset: number }>();
const ORDER_RATE_LIMIT = 5; // 5 requests per minute per user/IP
const WINDOW_MS = 60 * 1000;

export const orderRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const key = req.user?.userId || req.ip || "anonymous";
  const now = Date.now();
  let record = orderRequests.get(key);

  if (!record || now - record.lastReset > WINDOW_MS) {
    record = { count: 1, lastReset: now };
  } else {
    record.count++;
    if (record.count > ORDER_RATE_LIMIT) {
      throw new ApiError(429, OrderErrorCode.RATE_LIMIT_EXCEEDED, {value:["Too many order requests"]});
    }
  }

  orderRequests.set(key, record);
  next();
};