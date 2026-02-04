import { Request, Response } from "express";
import {
  getCategoriesService,
  getCategoryTreeService,
  getCategoryBySlugService
} from "../services/category.services";

import { ApiError, ApiResponse, asyncHandler } from "../utils/api";
import { slugSchema } from "@repo/zod-schema/index";

async function getCategories(req: Request, res: Response) {
  const categories = await getCategoriesService();
  return new ApiResponse(200, categories, "Categories fetched successfully").send(res);
}

async function getCategoryTree(req: Request, res: Response) {
  const tree = await getCategoryTreeService();
  return new ApiResponse(200, tree, "Category tree fetched successfully").send(res);
}

async function getCategoryBySlug(req: Request, res: Response) {
  const result = slugSchema.safeParse(req.params.slug);

  if (!result.success) {
    throw new ApiError(400, "Invalid category slug");
  }

  const slug = result.data;

  const category = await getCategoryBySlugService(slug);
  return new ApiResponse(200, category, "Category fetched successfully").send(res);
}



export const getCategoriesController = asyncHandler(getCategories);
export const getCategoryTreeController = asyncHandler(getCategoryTree);
export const getCategoryBySlugController = asyncHandler(getCategoryBySlug);