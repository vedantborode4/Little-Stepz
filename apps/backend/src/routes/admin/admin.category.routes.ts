import { Router } from "express";
import {
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
} from "../../controllers/admin/admin.category.controllers";

export const adminCategoryRouter:Router = Router();


adminCategoryRouter.post("/", createCategoryController);
adminCategoryRouter.put("/:id", updateCategoryController);
adminCategoryRouter.delete("/:id", deleteCategoryController);
