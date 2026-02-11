import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import {
  getCouponsService,
  createCouponService,
  updateCouponService,
  deleteCouponService,
} from "../../services/admin/admin.coupons.services";
import { createCouponBodySchema, updateCouponBodySchema, couponParamsSchema } from "@repo/zod-schema/index";

async function getCoupons(req: Request, res: Response) {

    const { page = 1, limit = 20, activeOnly = false, sort = "createdAt:desc" } = req.query;
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const parsedActiveOnly = activeOnly === "true";

    if (isNaN(parsedPage) || isNaN(parsedLimit)) throw new ApiError(400, "Invalid pagination");

    const result = await getCouponsService(parsedPage, parsedLimit, parsedActiveOnly, sort as string);

    return new ApiResponse(200, result, "Coupons fetched").send(res);
}

async function createCoupon(req: Request, res: Response) {
    const validated = createCouponBodySchema.parse(req.body);
    const coupon = await createCouponService(validated, req.user?.userId);
    return new ApiResponse(201, coupon, "Coupon created").send(res);
}

async function updateCoupon(req: Request, res: Response) {
    const { id } = couponParamsSchema.parse(req.params);
    const validated = updateCouponBodySchema.parse(req.body);
    const coupon = await updateCouponService(id, validated, req.user?.userId);
    return new ApiResponse(200, coupon, "Coupon updated").send(res);
}

async function deleteCoupon(req: Request, res: Response) {
    const { id } = couponParamsSchema.parse(req.params);
    await deleteCouponService(id, req.user?.userId);
    return new ApiResponse(200, null, "Coupon deleted").send(res);
}

export const getCouponsController = asyncHandler(getCoupons);
export const createCouponController = asyncHandler(createCoupon);
export const updateCouponController = asyncHandler(updateCoupon);
export const deleteCouponController = asyncHandler(deleteCoupon);