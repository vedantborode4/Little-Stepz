import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import {
  getAdminOrdersService,
  updateOrderStatusService,
} from "../../services/admin/admin.orders.services";
import {
  updateOrderStatusBodySchema,
  orderParamsSchema,
} from "@repo/zod-schema/index";
import { OrderStatus } from "@repo/db/client";

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

  const result = await getAdminOrdersService(
    parsedPage,
    parsedLimit,
    parsedStatus,
    parsedFromDate,
    parsedToDate
  );

  return new ApiResponse(200, result, "Admin orders fetched").send(res);
}

async function updateOrderStatus(req: Request, res: Response) {
  const adminId = req.user?.userId;
  if (!adminId) throw new ApiError(401, "Unauthorized");

  const { id } = orderParamsSchema.parse(req.params);
  const validated = updateOrderStatusBodySchema.parse(req.body);

  const updatedOrder = await updateOrderStatusService(
    id,
    validated.status as OrderStatus,
    adminId
  );

  return new ApiResponse(200, updatedOrder, "Order status updated").send(res);
}

export const getAdminOrdersController = asyncHandler(getAdminOrders);
export const updateOrderStatusController = asyncHandler(updateOrderStatus);
