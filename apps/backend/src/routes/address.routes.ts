import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  getAddressesController,
  createAddressController,
  updateAddressController,
  deleteAddressController,
  setDefaultAddressController,
} from "../controllers/address.controllers";

export const addressRouter:Router = Router();

addressRouter.use(authMiddleware);

addressRouter.get("/", getAddressesController);
addressRouter.post("/", createAddressController);
addressRouter.put("/:id", updateAddressController);
addressRouter.delete("/:id", deleteAddressController);
addressRouter.patch("/:id/default", setDefaultAddressController);
