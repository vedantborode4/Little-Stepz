import { Router } from "express";
import {
  getCategoriesController,
  getCategoryBySlugController,
  getCategoryTreeController,
} from "../controllers/category.controllers";

export const categoryRouter:Router = Router();

categoryRouter.get("/", getCategoriesController);
categoryRouter.get("/tree", getCategoryTreeController);
categoryRouter.get("/:slug", getCategoryBySlugController);
