import { Request, Response } from 'express';
import { asyncHandler, ApiError, ApiResponse } from '../utils/api';
import {
  createOrderService,
  getOrdersService,
  getOrderByIdService,
  getOrderInvoiceService,
  cancelOrderService,
} from '../services/orders.services';
import { orderParamsSchema } from '@repo/zod-schema/index';
import { OrderErrorCode } from '../utils/orderErrors';

async function createOrder(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey) throw new ApiError(400, OrderErrorCode.IDEMPOTENCY_KEY_REQUIRED);

  // Bypass schema.parse() entirely — the workspace zod-schema may not include
  // cartItems/couponCode, silently stripping them and causing CART_EMPTY/Validation failed errors.
  // Manually validate what we need instead.
  const body = req.body ?? {};

  const addressId = typeof body.addressId === 'string' ? body.addressId.trim() : null;
  if (!addressId) throw new ApiError(400, 'addressId is required');

  const rawCartItems: Array<{ productId: string; variantId?: string; quantity: number }> = body.cartItems;
  if (!Array.isArray(rawCartItems) || rawCartItems.length === 0) {
    throw new ApiError(400, OrderErrorCode.CART_EMPTY);
  }

  // Validate each cart item has required fields
  for (const item of rawCartItems) {
    if (typeof item.productId !== 'string' || !item.productId) {
      throw new ApiError(400, 'Each cart item must have a productId');
    }
    if (typeof item.quantity !== 'number' || item.quantity < 1) {
      throw new ApiError(400, 'Each cart item must have a valid quantity');
    }
  }

  const couponCode: string | undefined =
    typeof body.couponCode === 'string' && body.couponCode.trim()
      ? body.couponCode.trim()
      : undefined;

  const paymentMethod: 'ONLINE' | 'COD' =
    body.paymentMethod === 'COD' ? 'COD' : 'ONLINE';

  const customerNote: string | undefined =
    typeof body.customerNote === 'string' && body.customerNote.trim()
      ? body.customerNote.trim().slice(0, 500)
      : undefined;

  const validated = {
    addressId,
    cartItems: rawCartItems,
    paymentMethod,
    ...(couponCode ? { couponCode } : {}),
    ...(customerNote ? { customerNote } : {}),
  };

  let affiliateId: string | undefined;
  const rawAffiliateId = req.cookies?.ref || req.get('X-Affiliate-Id');
  if (rawAffiliateId && typeof rawAffiliateId === 'string') {
    const { prisma } = await import('@repo/db/client');
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: rawAffiliateId, status: 'APPROVED', deletedAt: null },
      select: { id: true, userId: true },
    });
    if (affiliate && affiliate.userId !== userId) {
      affiliateId = affiliate.id;
    }
  }

  const order = await createOrderService(userId, validated, idempotencyKey, affiliateId);

  return new ApiResponse(201, order, 'Order created').send(res);
}

async function getOrders(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Unauthorized');
  const { page = 1, limit = 20, status } = req.query;
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const parsedStatus = status as string | undefined;

  if (isNaN(parsedPage) || isNaN(parsedLimit)) throw new ApiError(400, 'Invalid pagination');

  const result = await getOrdersService(userId, parsedPage, parsedLimit, parsedStatus);

  return new ApiResponse(200, result, 'Orders fetched').send(res);
}

async function getOrderById(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Unauthorized');
  const { id } = orderParamsSchema.parse(req.params);

  const order = await getOrderByIdService(userId, id);

  return new ApiResponse(200, order, 'Order fetched').send(res);
}

async function getOrderInvoice(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Unauthorized');
  const { id } = orderParamsSchema.parse(req.params);

  const invoice = await getOrderInvoiceService(userId, id);

  return new ApiResponse(200, invoice, 'Invoice fetched').send(res);
}


async function cancelOrder(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Unauthorized');
  const { id } = orderParamsSchema.parse(req.params);
  const reason = req.body?.reason as string | undefined;
  const result = await cancelOrderService(userId, id, reason);
  return new ApiResponse(200, result, 'Order cancelled').send(res);
}

export const createOrderController = asyncHandler(createOrder);
export const getOrdersController = asyncHandler(getOrders);
export const getOrderByIdController = asyncHandler(getOrderById);
export const getOrderInvoiceController = asyncHandler(getOrderInvoice);
export const cancelOrderController = asyncHandler(cancelOrder);