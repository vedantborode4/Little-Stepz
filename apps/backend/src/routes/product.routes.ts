import { Router } from "express";
import {
  getProductsController,
  getProductBySlugController,
  searchProductsController,
  getProductsByCategorySlugController,
  getSearchSuggestionsController,
} from "../controllers/product.controllers";
import { getProductReviewsController } from "../controllers/review.controllers";

export const productRouter:Router = Router();

productRouter.get("/", getProductsController);
productRouter.get("/search/suggestions", getSearchSuggestionsController);
productRouter.get("/search", searchProductsController);
productRouter.get("/category/:categorySlug", getProductsByCategorySlugController);

productRouter.get("/:productId/reviews", getProductReviewsController);

productRouter.get("/:slug", getProductBySlugController);