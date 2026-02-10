// src/controllers/admin/admin.product.image.controllers.ts
import { Request, Response } from "express";
import { asyncHandler, ApiResponse, ApiError } from "../../utils/api";
import {
  addProductImageSchema,
  productImageParamsSchema,
  reorderImageBodySchema,
} from "@repo/zod-schema/index";
import {
  addProductImageService,
  reorderProductImageService,
  deleteProductImageService,
} from "../../services/admin/admin.image.services";

export const addProductImageController = asyncHandler(
  async (req: Request, res: Response) => {
  const parsed = addProductImageSchema.safeParse({  
    params: req.params,
    body: req.body,
  });
  if (!parsed.success)
    throw new ApiError(400, "Invalid product image data", parsed.error.flatten().fieldErrors);

    const image = await addProductImageService(
      parsed.data.params.productId, 
      parsed.data.body
    );

    return new ApiResponse(201, image, "Product image added").send(res);
  }
);

export const reorderProductImageController = asyncHandler(
  async (req: Request, res: Response) => {
    const { imageId } = productImageParamsSchema.parse(req.params);
    const { sortOrder } = reorderImageBodySchema.parse(req.body);

    const image = await reorderProductImageService(imageId, sortOrder);

    return new ApiResponse(200, image, "Image reordered").send(res);
  }
);

export const deleteProductImageController = asyncHandler(
  async (req: Request, res: Response) => {
    const { imageId } = productImageParamsSchema.parse(req.params);

    await deleteProductImageService(imageId);

    return new ApiResponse(200, null, "Image deleted").send(res);
  }
);
