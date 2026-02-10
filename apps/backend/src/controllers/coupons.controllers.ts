import { Request, Response } from 'express';
import { asyncHandler, ApiError, ApiResponse } from '../utils/api';
import { validateCouponService } from '../services/coupons.services';
import { validateCouponBodySchema } from '@repo/zod-schema/index';
import { Decimal } from 'decimal.js';

async function validateCoupon(req: Request, res: Response) {
  const validated = validateCouponBodySchema.parse(req.body);
  const identifier = req.cartIdentifier;
  if (!identifier) throw new ApiError(400, 'Missing cart identifier');

  const { discount } = await validateCouponService(identifier, validated.code, new Decimal(validated.orderAmount));

  return new ApiResponse(200, { valid: true, discount: discount.toNumber() }, 'Coupon validated').send(res);
}

export const validateCouponController = asyncHandler(validateCoupon);