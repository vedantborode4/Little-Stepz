import { Request, Response } from 'express';
import { asyncHandler, ApiError, ApiResponse } from '../utils/api';
import {
  createOrderService,
  getOrdersService,
  getOrderByIdService,
  getOrderInvoiceService,
} from '../services/orders.services';
import { createOrderBodySchema, orderParamsSchema } from '@repo/zod-schema/index';
import { OrderErrorCode } from '../utils/orderErrors';

async function createOrder(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Unauthorized');
  const validated = createOrderBodySchema.parse(req.body);

  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey) throw new ApiError(400, OrderErrorCode.IDEMPOTENCY_KEY_REQUIRED);


  let affiliateId: string | undefined;
  const rawAffiliateId = req.cookies?.ref;
  if (rawAffiliateId && typeof rawAffiliateId === 'string') {
    const { prisma } = await import('@repo/db/client');
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: rawAffiliateId, status: 'APPROVED', deletedAt: null },
      select: { id: true, userId: true },
    });
    // Don't allow self-referral
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

export const createOrderController = asyncHandler(createOrder);
export const getOrdersController = asyncHandler(getOrders);
export const getOrderByIdController = asyncHandler(getOrderById);
export const getOrderInvoiceController = asyncHandler(getOrderInvoice);