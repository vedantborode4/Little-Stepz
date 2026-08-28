import { Request, Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/api";
import {
  adminCustomersQuerySchema,
  adminCustomerParamSchema,
  adminCartActivityQuerySchema,
} from "@repo/zod-schema/index";
import {
  listCustomersService,
  getCustomerService,
  listCartActivityService,
} from "../../services/admin/admin.customers.services";

async function listCustomers(req: Request, res: Response) {
  const query = adminCustomersQuerySchema.parse(req.query);
  const result = await listCustomersService(query);
  return new ApiResponse(200, result, "Customers fetched").send(res);
}

async function getCustomer(req: Request, res: Response) {
  const { id } = adminCustomerParamSchema.parse(req.params);
  const result = await getCustomerService(id);
  return new ApiResponse(200, result, "Customer fetched").send(res);
}

async function listCartActivity(req: Request, res: Response) {
  const query = adminCartActivityQuerySchema.parse(req.query);
  const result = await listCartActivityService(query);
  return new ApiResponse(200, result, "Cart activity fetched").send(res);
}

export const listCustomersController    = asyncHandler(listCustomers);
export const getCustomerController      = asyncHandler(getCustomer);
export const listCartActivityController = asyncHandler(listCartActivity);
