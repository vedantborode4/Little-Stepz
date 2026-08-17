import { Router } from "express";
import {
  getWarehouseStatusController,
  registerWarehouseController,
} from "../../controllers/admin/admin.shipping.controllers";

export const adminShippingRouter: Router = Router();

adminShippingRouter.get("/warehouse", getWarehouseStatusController);

adminShippingRouter.post("/warehouse", registerWarehouseController);
