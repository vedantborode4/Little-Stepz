import { Router } from "express";
import { createShipmentController, cancelShipmentController, resolveReturnController } from "../../controllers/admin/admin.payment.controllers";


export const adminPaymentRouter: Router = Router();


adminPaymentRouter.put("/returns/:id/resolve", resolveReturnController);

adminPaymentRouter.post("/orders/:id/ship", createShipmentController);

adminPaymentRouter.post("/orders/:id/cancel-shipment", cancelShipmentController);
