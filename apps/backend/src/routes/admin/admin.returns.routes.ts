import { Router } from "express";
import {
  listReturnsController,
  getReturnController,
  scheduleReturnPickupController,
  markReturnPickedUpController,
  receiveReturnController,
  settleReturnRefundController,
  retryReturnRefundController,
} from "../../controllers/admin/admin.returns.controllers";

// `PUT /returns/:id/resolve` stays in admin.payment.routes — older admin clients call it,
// and it branches between legacy and item returns itself.
export const adminReturnsRouter: Router = Router();

adminReturnsRouter.get("/returns", listReturnsController);
adminReturnsRouter.get("/returns/:id", getReturnController);
adminReturnsRouter.post("/returns/:id/pickup", scheduleReturnPickupController);
adminReturnsRouter.post("/returns/:id/picked-up", markReturnPickedUpController);
adminReturnsRouter.post("/returns/:id/receive", receiveReturnController);
adminReturnsRouter.post("/return-refunds/:id/settle", settleReturnRefundController);
adminReturnsRouter.post("/return-refunds/:id/retry", retryReturnRefundController);
