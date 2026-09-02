import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import {
  getAdminOrdersService,
  getAdminOrderByIdService,
  updateOrderStatusService,
} from "../../services/admin/admin.orders.services";
import { runStockSweep } from "../../services/stockSweeper.services";
import { markBalancePaidService, writeOffBalanceService } from "../../services/codSettlement.services";
import {
  updateOrderStatusBodySchema,
  markBalancePaidBodySchema,
  writeOffBalanceBodySchema,
  orderParamsSchema,
} from "@repo/zod-schema/index";
import { OrderStatus } from "@repo/db/client";
import { getInvoicePdfService, invoiceFileName } from "../../services/invoice.services";

async function getAdminOrders(req: Request, res: Response) {
  const { page = 1, limit = 20, status, fromDate, toDate } = req.query;

  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  if (isNaN(parsedPage) || isNaN(parsedLimit)) {
    throw new ApiError(400, "Invalid pagination");
  }

  let parsedStatus: OrderStatus | undefined = undefined;

  if (status) {
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      throw new ApiError(400, "Invalid status");
    }
    parsedStatus = status as OrderStatus;
  }

  let parsedFromDate: Date | undefined;
  if (fromDate) {
    parsedFromDate = new Date(fromDate as string);
    if (isNaN(parsedFromDate.getTime())) {
      throw new ApiError(400, "Invalid fromDate");
    }
  }

  let parsedToDate: Date | undefined;
  if (toDate) {
    parsedToDate = new Date(toDate as string);
    if (isNaN(parsedToDate.getTime())) {
      throw new ApiError(400, "Invalid toDate");
    }
  }

  // Validated against the known values rather than passed through, so an unexpected
  // query string cannot reach the Prisma filter.
  const rawPlan = req.query.paymentPlan as string | undefined;
  const paymentPlan =
    rawPlan === "FULL" || rawPlan === "PARTIAL" ? rawPlan : undefined;

  const rawBalance = req.query.balanceState as string | undefined;
  const balanceState =
    rawBalance === "due" || rawBalance === "settled" ? rawBalance : undefined;

  const result = await getAdminOrdersService(
    parsedPage,
    parsedLimit,
    parsedStatus,
    parsedFromDate,
    parsedToDate,
    paymentPlan,
    balanceState
  );

  return new ApiResponse(200, result, "Admin orders fetched").send(res);
}

async function getAdminOrderById(req: Request, res: Response) {
  const { id } = orderParamsSchema.parse(req.params);
  const result = await getAdminOrderByIdService(id);
  return new ApiResponse(200, result, "Order fetched").send(res);
}

/**
 * Record a partial order's balance as collected outside the gateway.
 *
 * Deliberately admin-only and audited: this books real money on the word of a person,
 * so who did it and what reference they gave has to survive the click.
 */
async function markBalancePaid(req: Request, res: Response) {
  const adminId = req.user?.userId;
  if (!adminId) throw new ApiError(401, "Unauthorized");

  const { id } = orderParamsSchema.parse(req.params);
  const body = markBalancePaidBodySchema.parse(req.body ?? {});

  const result = await markBalancePaidService(id, adminId, body);

  return new ApiResponse(200, result, "Balance marked as paid").send(res);
}

/**
 * Close out a balance that will never be collected and record the deposit as retained.
 *
 * Distinct from cancelling the order: cancelling implies stock returned and money to be
 * moved, while this is only the money on an order whose fate the courier already recorded.
 */
async function writeOffBalance(req: Request, res: Response) {
  const adminId = req.user?.userId;
  if (!adminId) throw new ApiError(401, "Unauthorized");

  const { id } = orderParamsSchema.parse(req.params);
  const body = writeOffBalanceBodySchema.parse(req.body ?? {});

  const result = await writeOffBalanceService(id, adminId, body);

  return new ApiResponse(200, result, "Balance written off").send(res);
}

async function updateOrderStatus(req: Request, res: Response) {
  const adminId = req.user?.userId;
  if (!adminId) throw new ApiError(401, "Unauthorized");

  const { id } = orderParamsSchema.parse(req.params);
  const validated = updateOrderStatusBodySchema.parse(req.body);

  const updatedOrder = await updateOrderStatusService(
    id,
    validated.status as OrderStatus,
    adminId,
    validated.cancellationParty
  );

  return new ApiResponse(200, updatedOrder, "Order status updated").send(res);
}

async function reclaimStock(_req: Request, res: Response) {
  const result = await runStockSweep();
  return new ApiResponse(200, result, "Stale holds reclaimed").send(res);
}

export const getAdminOrdersController = asyncHandler(getAdminOrders);
export const getAdminOrderByIdController = asyncHandler(getAdminOrderById);
export const markBalancePaidController = asyncHandler(markBalancePaid);
export const writeOffBalanceController = asyncHandler(writeOffBalance);
export const updateOrderStatusController = asyncHandler(updateOrderStatus);
export const reclaimStockController = asyncHandler(reclaimStock);

/** Admin copy of a customer's tax invoice. Same document, no user scoping. */
async function getAdminOrderInvoice(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { pdf, number } = await getInvoicePdfService(id);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoiceFileName(number)}"`);
  res.setHeader("Content-Length", String(pdf.length));
  return res.send(pdf);
}

export const getAdminOrderInvoiceController = asyncHandler(getAdminOrderInvoice);
