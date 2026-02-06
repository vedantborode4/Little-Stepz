import { Router } from "express";
import {
  getProductsController,
  getProductBySlugController,
  searchProductsController,
  getProductsByCategorySlugController,
  getSearchSuggestionsController,
} from "../controllers/product.controllers";

export const productRouter:Router = Router();

productRouter.get("/", getProductsController);
productRouter.get("/:slug", getProductBySlugController);
productRouter.get("/search", searchProductsController);
productRouter.get("/search/suggestions", getSearchSuggestionsController);
productRouter.get("/category/:categorySlug", getProductsByCategorySlugController);