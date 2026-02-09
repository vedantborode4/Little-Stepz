import { Router } from "express";
import { createProductController, deleteProductController, updateProductController } from "../../controllers/admin/admin.product.controllers";
import { createVariantController, deleteVariantController, updateVariantController } from "../../controllers/admin/admin.variant.controllers";

export const adminProductRouter:Router = Router();

adminProductRouter.post("/", createProductController);
adminProductRouter.put("/:id", updateProductController);
adminProductRouter.delete("/:id", deleteProductController);

adminProductRouter.post("/:productId/variants", createVariantController);
adminProductRouter.put("/variants/:id", updateVariantController);
adminProductRouter.delete("/variants/:id", deleteVariantController);