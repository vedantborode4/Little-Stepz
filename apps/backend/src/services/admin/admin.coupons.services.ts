import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { CouponErrorCode } from "../../utils/couponErrors";
import { Decimal } from "decimal.js";
import type { CreateCouponBody, UpdateCouponBody } from "@repo/zod-schema/index";


type SortField = "createdAt" | "usedCount" | "value";
type SortOrder = "asc" | "desc";

const allowedSorts: SortField[] = ["createdAt", "usedCount", "value"];

function parseSort(sort: string): { field: SortField; order: SortOrder } {
  const [field, order] = sort.split(":");
  return {
    field: allowedSorts.includes(field as SortField) ? field as SortField : "createdAt",
    order: order === "asc" ? "asc" : "desc",
  };
}

export async function getCouponsService(page: number, limit: number, activeOnly: boolean, sort: string) {
  const skip = (page - 1) * limit;
  const { field, order } = parseSort(sort);

  const where: any = { deletedAt: null };
  if (activeOnly) {
    where.isActive = true;
    where.OR = [
      { validUntil: null },
      { validUntil: { gte: new Date() } },
    ];
  }

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      skip: Math.max(skip, 0),
      take: Math.min(limit, 100), // Safety cap
      orderBy: { [field]: order },
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        minOrderValue: true,
        maxDiscount: true,
        usageLimit: true,
        usedCount: true,
        validFrom: true,
        validUntil: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.coupon.count({ where }),
  ]);

  return {
    coupons,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function createCouponService(data: CreateCouponBody, adminId: string | undefined) {
  if (data.validFrom && data.validUntil && data.validFrom > data.validUntil) {
    throw new ApiError(400, CouponErrorCode.INVALID_DATE_RANGE);
  }

  if (data.type === "PERCENTAGE" && data.value > 100) {
    throw new ApiError(400, CouponErrorCode.INVALID_VALUE, {
        value: ["Percentage cannot exceed 100"],
    });
  }

  if (data.usageLimit === 0) delete data.usageLimit; // Treat 0 as unlimited

  try {
    const coupon = await prisma.coupon.create({
      data: {
        ...data,
        code: data.code.trim().toUpperCase(),
        value: new Decimal(data.value),
        minOrderValue: data.minOrderValue ? new Decimal(data.minOrderValue) : undefined,
        maxDiscount: data.maxDiscount ? new Decimal(data.maxDiscount) : undefined,
      },
    });

    return coupon;
  } catch (err: any) {
    if (err.code === "P2002" && err.meta?.constraint === "Coupon_code_key") {
      throw new ApiError(409, CouponErrorCode.DUPLICATE_COUPON_CODE);
    }
    throw err;
  }
}

export async function updateCouponService(id: string, data: UpdateCouponBody, adminId: string | undefined) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.coupon.findUnique({
      where: { id },
    });

    if (!existing) throw new ApiError(404, CouponErrorCode.COUPON_NOT_FOUND);
    if (existing.deletedAt) throw new ApiError(400, CouponErrorCode.COUPON_DELETED);

    // Optimistic lock: check updatedAt matches
    if (data.updatedAt && existing.updatedAt.getTime() !== new Date(data.updatedAt).getTime()) {
      throw new ApiError(409, CouponErrorCode.OPTIMISTIC_LOCK_FAILED);
    }

    if (existing.usedCount > 0) {
      // Restrict mutations if used
      if (data.type !== undefined || data.value !== undefined) {
        throw new ApiError(400, "Cannot change type or value after usage");
      }
    }

    if (data.usageLimit !== undefined && existing.usedCount > data.usageLimit) {
      throw new ApiError(400, CouponErrorCode.USAGE_LIMIT_TOO_LOW);
    }

    if (data.validFrom !== undefined && data.validUntil !== undefined && data.validFrom > data.validUntil) {
      throw new ApiError(400, CouponErrorCode.INVALID_DATE_RANGE);
    }

    if (data.type === "PERCENTAGE" && data.value !== undefined && data.value > 100) {
        throw new ApiError(400, CouponErrorCode.INVALID_VALUE, {
            value: ["Percentage cannot exceed 100"],
        })
    }

    const updateData: any = { ...data };
    if (data.code) updateData.code = data.code.trim().toUpperCase();
    if (data.value !== undefined) updateData.value = new Decimal(data.value);
    if (data.minOrderValue !== undefined) updateData.minOrderValue = data.minOrderValue ? new Decimal(data.minOrderValue) : null;
    if (data.maxDiscount !== undefined) updateData.maxDiscount = data.maxDiscount ? new Decimal(data.maxDiscount) : null;
    if (data.usageLimit === 0) updateData.usageLimit = null;

    const updated = await tx.coupon.update({
      where: { id },
      data: updateData,
    });


    return updated;
  });
}

export async function deleteCouponService(id: string, adminId: string | undefined) {
  const existing = await prisma.coupon.findUnique({
    where: { id },
  });

  if (!existing) throw new ApiError(404, CouponErrorCode.COUPON_NOT_FOUND);
  if (existing.deletedAt) return; // Idempotent

  // Check if in use (optional strictness; allow delete but orders keep reference)
  const orderCount = await prisma.order.count({ where: { couponId: id } });
  if (orderCount > 0) {
    console.warn(`Deleting coupon ${id} linked to ${orderCount} orders`);
    // Proceed, as soft delete
  }

  await prisma.coupon.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });


  // In prod, add metrics: promClient.counter("coupon_deletes").inc();
}