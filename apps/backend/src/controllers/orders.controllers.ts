import { Request, Response } from 'express';
import { asyncHandler, ApiError, ApiResponse } from '../utils/api';
import {
  createOrderService,
  getOrdersService,
  getOrderByIdService,
  cancelOrderService,
  abandonOrderService,
} from '../services/orders.services';
import {
  getInvoicePdfService,
  invoiceFileName,
  getAdvanceReceiptPdfService,
  receiptFileName,
} from '../services/invoice.services';
import { orderParamsSchema, createOrderBodySchema } from '@repo/zod-schema/index';
import { OrderErrorCode } from '../utils/orderErrors';

async function createOrder(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey) throw new ApiError(400, OrderErrorCode.IDEMPOTENCY_KEY_REQUIRED);

  // Validated by the shared schema, which is the single source of truth for request
  // shapes (CLAUDE.md). This used to hand-roll the checks and bypass `.parse()` entirely,
  // blaming a stale `@repo/zod-schema` build for stripping `cartItems`/`couponCode` — but
  // the stale build was the actual bug, and the workaround meant `paymentMethod` was
  // hardcoded here and every new field had to be added in two places.
  //
  // `paymentMethod` still collapses to ONLINE inside the schema (see
  // retiredCodPaymentMethod), so published builds that send 'COD' keep working.
  let validated;
  try {
    validated = createOrderBodySchema.parse(req.body ?? {});
  } catch (err: any) {
    // Preserve the typed codes both clients already map to friendly copy; a raw Zod
    // message would surface to the customer verbatim.
    const first = err?.issues?.[0];
    const path = Array.isArray(first?.path) ? first.path.join('.') : '';
    if (path.startsWith('cartItems')) throw new ApiError(400, OrderErrorCode.CART_EMPTY);
    if (path.startsWith('addressId')) throw new ApiError(400, OrderErrorCode.INVALID_ADDRESS);
    throw new ApiError(400, first?.message ?? 'Validation failed');
  }

  // The forfeiture term is the contractual basis for keeping a deposit, so the
  // acknowledgement is required server-side rather than trusted to the UI.
  if (validated.paymentPlan === 'PARTIAL' && !validated.acceptForfeitTerms) {
    throw new ApiError(400, OrderErrorCode.FORFEIT_TERMS_NOT_ACCEPTED);
  }

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

/**
 * The customer's own tax invoice, as a PDF.
 *
 * Scoped by userId inside the service, so one customer cannot read another's
 * invoice by guessing an order id. Responds with the binary rather than an
 * ApiResponse envelope — this endpoint is consumed by a download, not by JSON.
 */
async function getOrderInvoice(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Unauthorized');
  const { id } = orderParamsSchema.parse(req.params);

  const { pdf, number } = await getInvoicePdfService(id, userId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoiceFileName(number)}"`);
  res.setHeader('Content-Length', String(pdf.length));
  return res.send(pdf);
}


/**
 * The deposit acknowledgement for a partial-payment order, as a PDF.
 *
 * Separate from the invoice endpoint because it is a different document with different
 * rules: available as soon as the deposit is captured, while the tax invoice only exists
 * once the order is dispatched.
 */
async function getOrderReceipt(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Unauthorized');
  const { id } = orderParamsSchema.parse(req.params);

  const { pdf, reference } = await getAdvanceReceiptPdfService(id, userId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${receiptFileName(reference)}"`);
  res.setHeader('Content-Length', String(pdf.length));
  return res.send(pdf);
}

async function cancelOrder(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Unauthorized');
  const { id } = orderParamsSchema.parse(req.params);
  const reason = req.body?.reason as string | undefined;
  // Explicit acknowledgement that a partial order's deposit is forfeited. The service
  // rejects the cancellation without it, so the client must have shown the amount.
  const confirmForfeit = req.body?.confirmForfeit === true;
  const result = await cancelOrderService(userId, id, reason, { confirmForfeit });
  return new ApiResponse(200, result, 'Order cancelled').send(res);
}

async function abandonOrder(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Unauthorized');
  const { id } = orderParamsSchema.parse(req.params);
  const result = await abandonOrderService(userId, id);
  return new ApiResponse(200, result, 'Checkout abandoned').send(res);
}

export const createOrderController = asyncHandler(createOrder);
export const getOrdersController = asyncHandler(getOrders);
export const getOrderByIdController = asyncHandler(getOrderById);
export const getOrderInvoiceController = asyncHandler(getOrderInvoice);
export const getOrderReceiptController = asyncHandler(getOrderReceipt);
export const cancelOrderController = asyncHandler(cancelOrder);
export const abandonOrderController = asyncHandler(abandonOrder);