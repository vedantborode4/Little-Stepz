import { Router } from "express";
import { createProductController, deleteProductController, updateProductController } from "../../controllers/admin/admin.product.controllers";
import { createVariantController, deleteVariantController, updateVariantController } from "../../controllers/admin/admin.variant.controllers";
import { addProductImageController, deleteProductImageController, reorderProductImageController } from "../../controllers/admin/admin.image.controllers";

export const adminProductRouter:Router = Router();

adminProductRouter.post("/", createProductController);
adminProductRouter.put("/:id", updateProductController);
adminProductRouter.delete("/:id", deleteProductController);

adminProductRouter.post("/:productId/variants", createVariantController);
adminProductRouter.put("/variants/:id", updateVariantController);
adminProductRouter.delete("/variants/:id", deleteVariantController);

adminProductRouter.post("/:productId/images", addProductImageController);
adminProductRouter.put("/images/:imageId/reorder", reorderProductImageController);
adminProductRouter.delete("/images/:imageId", deleteProductImageController);