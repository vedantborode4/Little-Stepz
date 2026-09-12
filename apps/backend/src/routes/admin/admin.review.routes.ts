import { Router } from "express";
import { deleteReviewController, getAdminReviewsController } from "../../controllers/admin/admin.review.controllers";

export const adminReviewRouter: Router = Router();

adminReviewRouter.get("/", getAdminReviewsController);
adminReviewRouter.delete("/:reviewId", deleteReviewController);