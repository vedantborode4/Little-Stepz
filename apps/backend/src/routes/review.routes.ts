// src/routes/review.routes.ts
import { Router } from "express";
import {
  createReviewController,
} from "../controllers/review.controllers";
import { authMiddleware } from "../middlewares/auth.middleware";

export const reviewRouter: Router = Router();

reviewRouter.post("/", authMiddleware, createReviewController);
// Note: GET /products/:productId/reviews is mounted separately in productRouter