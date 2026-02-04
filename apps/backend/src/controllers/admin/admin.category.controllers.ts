import { Request, Response } from "express";
import {
  createCategoryService,
  updateCategoryService,
  deleteCategoryService,
} from "../../services/admin/admin.category.services";

import { createCategorySchema, updateCategorySchema } from "@repo/zod-schema/index";
import { ApiError, ApiResponse, asyncHandler } from "../../utils/api";


async function createCategory(req: Request, res: Response) {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success)
    throw new ApiError(400, "Invalid category data", parsed.error.flatten().fieldErrors);

  const category = await createCategoryService(parsed.data);
  return new ApiResponse(201, category, "Category created successfully").send(res);
}

async function updateCategory(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) throw new ApiError(400, "Category ID is required");

  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success)
    throw new ApiError(400, "Invalid category data", parsed.error.flatten().fieldErrors);

  const category = await updateCategoryService(id, parsed.data);
  return new ApiResponse(200, category, "Category updated successfully").send(res);
}

async function deleteCategory(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) throw new ApiError(400, "Category ID is required");

  await deleteCategoryService(id);
  return res.status(204).send();
}

export const createCategoryController = asyncHandler(createCategory);
export const updateCategoryController = asyncHandler(updateCategory);
export const deleteCategoryController = asyncHandler(deleteCategory);