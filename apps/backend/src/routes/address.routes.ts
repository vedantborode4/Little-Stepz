import { Router } from "express";
import { authOrGuestMiddleware } from "../middlewares/auth.middleware";
import { guestAddressParam } from "../middlewares/guestScope.middleware";
import {
  getAddressesController,
  createAddressController,
  updateAddressController,
  deleteAddressController,
  setDefaultAddressController,
} from "../controllers/address.controllers";

export const addressRouter:Router = Router();

// Guests see and edit only addresses created in their own session (the list is filtered in the service).
addressRouter.use(authOrGuestMiddleware);
addressRouter.param("id", guestAddressParam);

addressRouter.get("/", getAddressesController);
addressRouter.post("/", createAddressController);
addressRouter.put("/:id", updateAddressController);
addressRouter.delete("/:id", deleteAddressController);
addressRouter.patch("/:id/default", setDefaultAddressController);
