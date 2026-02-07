import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import {
  createProductService,
  updateProductService,
  deleteProductService,
} from "../../services/admin/admin.product.services";
import { createProductSchema, updateProductSchema, uuidSchema } from "@repo/zod-schema/index";

async function createProduct(req: Request, res: Response) {
  const validated = createProductSchema.parse(req.body);
  const product = await createProductService(validated);
  return new ApiResponse(201, product, "Product created").send(res);
}

async function updateProduct(req: Request, res: Response) {
  const { id } = req.params;
  if(!id) throw new ApiError(400, "Product ID parameter is required");
  uuidSchema.parse(id);
  const validated = updateProductSchema.parse(req.body);
  const product = await updateProductService(id, validated);
  return new ApiResponse(200, product, "Product updated").send(res);
}

async function deleteProduct(req: Request, res: Response) {
  const { id } = req.params;
  if(!id) throw new ApiError(400, "Product ID parameter is required");
  uuidSchema.parse(id);
  await deleteProductService(id);
  return new ApiResponse(200, null, "Product deleted").send(res);
}

export const createProductController = asyncHandler(createProduct);
export const updateProductController = asyncHandler(updateProduct);
export const deleteProductController = asyncHandler(deleteProduct);