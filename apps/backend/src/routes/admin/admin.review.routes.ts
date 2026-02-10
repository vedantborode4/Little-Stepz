import { Router } from "express";
import { deleteReviewController } from "../../controllers/admin/admin.review.controllers";

export const adminReviewRouter: Router = Router();

adminReviewRouter.delete("/:reviewId", deleteReviewController);