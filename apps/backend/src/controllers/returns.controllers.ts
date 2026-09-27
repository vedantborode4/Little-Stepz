import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../utils/api";
import {
  orderParamsSchema,
  orderReturnParamsSchema,
  quoteReturnBodySchema,
  createItemReturnBodySchema,
} from "@repo/zod-schema/index";
import {
  getOrderReturnsService,
  quoteReturnService,
  getReturnUploadSignatureService,
  createItemReturnService,
  cancelReturnService,
} from "../services/returns.services";

function requireUser(req: Request): string {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  return userId;
}

async function getOrderReturns(req: Request, res: Response) {
  const userId = requireUser(req);
  const { id } = orderParamsSchema.parse(req.params);
  const result = await getOrderReturnsService(userId, id);
  return new ApiResponse(200, result, "Returns fetched").send(res);
}

async function quoteReturn(req: Request, res: Response) {
  const userId = requireUser(req);
  const { id } = orderParamsSchema.parse(req.params);
  const { items } = quoteReturnBodySchema.parse(req.body);
  const result = await quoteReturnService(userId, id, items);
  return new ApiResponse(200, result, "Refund estimated").send(res);
}

async function getUploadSignature(req: Request, res: Response) {
  const userId = requireUser(req);
  const { id } = orderParamsSchema.parse(req.params);
  const result = await getReturnUploadSignatureService(userId, id);
  return new ApiResponse(200, result, "Upload signature issued").send(res);
}

async function createReturn(req: Request, res: Response) {
  const userId = requireUser(req);
  const { id } = orderParamsSchema.parse(req.params);
  const body = createItemReturnBodySchema.parse(req.body);
  const result = await createItemReturnService(userId, id, body, req);
  return new ApiResponse(201, result, "Return request submitted").send(res);
}

async function cancelReturn(req: Request, res: Response) {
  const userId = requireUser(req);
  const { id, returnId } = orderReturnParamsSchema.parse(req.params);
  const result = await cancelReturnService(userId, id, returnId, req);
  return new ApiResponse(200, result, "Return cancelled").send(res);
}

export const getOrderReturnsController    = asyncHandler(getOrderReturns);
export const quoteReturnController        = asyncHandler(quoteReturn);
export const returnUploadSignatureController = asyncHandler(getUploadSignature);
export const createReturnController       = asyncHandler(createReturn);
export const cancelReturnController       = asyncHandler(cancelReturn);
