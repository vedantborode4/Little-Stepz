import { Router } from "express";
import { createProductController, deleteProductController, updateProductController, getProductByIdController } from "../../controllers/admin/admin.product.controllers";
import { createVariantController, deleteVariantController, updateVariantController } from "../../controllers/admin/admin.variant.controllers";
import { addProductImageController, addVariantImageController, deleteProductImageController, getCloudinarySignatureController, reorderProductImageController, replaceProductImageController } from "../../controllers/admin/admin.image.controllers";
import { generateVariantMatrixController, deleteOptionController } from "../../controllers/admin/admin.option.controllers";

export const adminProductRouter:Router = Router();

adminProductRouter.post("/", createProductController);
adminProductRouter.put("/:id", updateProductController);
adminProductRouter.delete("/:id", deleteProductController);

adminProductRouter.get("/images/upload-signature", getCloudinarySignatureController);

adminProductRouter.post("/:productId/variants", createVariantController);
adminProductRouter.post("/:productId/variants/matrix", generateVariantMatrixController);
adminProductRouter.put("/variants/:id", updateVariantController);
adminProductRouter.delete("/variants/:id", deleteVariantController);
adminProductRouter.post("/variants/:variantId/images", addVariantImageController);
adminProductRouter.delete("/options/:optionId", deleteOptionController);

adminProductRouter.post("/:productId/images", addProductImageController);
adminProductRouter.put("/images/:imageId/reorder", reorderProductImageController);
adminProductRouter.delete("/images/:imageId", deleteProductImageController);
adminProductRouter.put("/images/:imageId/replace", replaceProductImageController);

adminProductRouter.get("/:id", getProductByIdController);