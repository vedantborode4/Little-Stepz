import { Router } from "express";
import {
  listPreOrdersController,
  getAdminPreOrderByIdController,
  refundBookingController,
  cancelPreOrderController,
  resendBalanceLinkController,
} from "../../controllers/admin/admin.preorder.controllers";

export const adminPreOrderRouter: Router = Router();

adminPreOrderRouter.get("/", listPreOrdersController);
adminPreOrderRouter.get("/:id", getAdminPreOrderByIdController);
adminPreOrderRouter.post("/:id/refund-booking", refundBookingController);
adminPreOrderRouter.post("/:id/cancel", cancelPreOrderController);
adminPreOrderRouter.post("/:id/resend-link", resendBalanceLinkController);
