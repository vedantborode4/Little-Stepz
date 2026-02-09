import { Request, Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/api";
import {
  createVariantBodySchema,
  updateVariantBodySchema,
  variantParamsSchema,
} from "@repo/zod-schema/index";

import {
  createVariantService,
  updateVariantService,
  deleteVariantService,
} from "../../services/admin/admin.variant.services";

// Recommended: strengthen zod schemas outside this file
// e.g. price: z.number().min(0).nullable().optional()
//      stock: z.number().int().min(0).optional()

export const createVariantController = asyncHandler(async (req: Request, res: Response) => {
  const { productId, name, price, stock } = createVariantBodySchema.parse({
    ...req.body,
    productId: req.params.productId,
  });

  const variant = await createVariantService({ productId, name, price, stock });

  return new ApiResponse(201, variant, "Variant created successfully").send(res);
});

export const updateVariantController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = variantParamsSchema.parse(req.params);
  const data = updateVariantBodySchema.parse(req.body);

  const variant = await updateVariantService(id, data);

  return new ApiResponse(200, variant, "Variant updated successfully").send(res);
});

export const deleteVariantController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = variantParamsSchema.parse(req.params);

  await deleteVariantService(id);

  return new ApiResponse(200, null, "Variant deleted successfully").send(res);
});