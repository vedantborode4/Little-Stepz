import { Router } from "express";
import {
  listCustomersController,
  getCustomerController,
  listCartActivityController,
} from "../../controllers/admin/admin.customers.controllers";

export const adminCustomersRouter: Router = Router();

// Declared before "/:id" so "activity" is not swallowed as a customer id.
adminCustomersRouter.get("/activity", listCartActivityController);
adminCustomersRouter.get("/", listCustomersController);
adminCustomersRouter.get("/:id", getCustomerController);
