import { Request, Response } from "express";
import {
  createCategoryService,
  updateCategoryService,
  deleteCategoryService,
} from "../../services/admin/admin.category.services";

import { createCategorySchema } from "@repo/zod-schema/index";
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


  const { name, slug, description, parentId } = req.body;

  // name and slug are required on update (we always send them from the form)
  if (name !== undefined && typeof name === "string" && !name.trim()) {
    throw new ApiError(400, "Name cannot be empty");
  }
  if (slug !== undefined && typeof slug === "string" && !slug.trim()) {
    throw new ApiError(400, "Slug cannot be empty");
  }

  const updateData: Record<string, any> = {};

  if (name !== undefined)        updateData.name        = String(name).trim();
  if (slug !== undefined)        updateData.slug        = String(slug).trim();
  // description: empty string → null (treat as "cleared"), actual text → trimmed string
  if (description !== undefined) updateData.description = description === "" ? null : String(description).trim();

  // parentId handling:
  //   null or ""  → set parentId to null (make top-level)
  //   UUID string → set to that parent
  //   not present → don't touch
  if ("parentId" in req.body) {
    if (parentId === null || parentId === "") {
      updateData.parentId = null;
    } else if (typeof parentId === "string" && parentId.length > 0) {
      updateData.parentId = parentId;
    }
  }

  const category = await updateCategoryService(id, updateData as any);
  return new ApiResponse(200, category, "Category updated successfully").send(res);
}

async function deleteCategory(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) throw new ApiError(400, "Category ID is required");

  await deleteCategoryService(id);
  return new ApiResponse(200, null, "Category deleted successfully").send(res);
}

export const createCategoryController = asyncHandler(createCategory);
export const updateCategoryController = asyncHandler(updateCategory);
export const deleteCategoryController = asyncHandler(deleteCategory);
