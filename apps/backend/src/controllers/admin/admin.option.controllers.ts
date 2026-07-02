import { Request, Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/api";
import { matrixGenerateSchema, optionParamsSchema } from "@repo/zod-schema/index";
import {
  generateVariantMatrixService,
  deleteOptionService,
} from "../../services/admin/admin.option.services";

export const generateVariantMatrixController = asyncHandler(async (req: Request, res: Response) => {
  const productId = req.params.productId!;
  const data = matrixGenerateSchema.parse(req.body);

  const result = await generateVariantMatrixService(productId, data);

  return new ApiResponse(201, result, "Variant matrix generated").send(res);
});

export const deleteOptionController = asyncHandler(async (req: Request, res: Response) => {
  const { optionId } = optionParamsSchema.parse(req.params);

  await deleteOptionService(optionId);

  return new ApiResponse(200, null, "Option deleted").send(res);
});
