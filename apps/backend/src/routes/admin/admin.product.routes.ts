import { Router } from "express";
import { createProductController, deleteProductController, updateProductController } from "../../controllers/admin/admin.product.controllers";

export const adminProductRouter:Router = Router();

adminProductRouter.post("/", createProductController);
adminProductRouter.put("/:id", updateProductController);
adminProductRouter.delete("/:id", deleteProductController);