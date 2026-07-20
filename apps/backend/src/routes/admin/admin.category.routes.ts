import { Router } from "express";
import {
  getCategoriesController,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
} from "../../controllers/admin/admin.category.controllers";

export const adminCategoryRouter:Router = Router();


adminCategoryRouter.get("/", getCategoriesController);
adminCategoryRouter.post("/", createCategoryController);
adminCategoryRouter.put("/:id", updateCategoryController);
adminCategoryRouter.delete("/:id", deleteCategoryController);
