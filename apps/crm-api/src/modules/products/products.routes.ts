import express, { Router } from "express";
import { IMAGE_MAX_BYTES } from "@repo/crm-schema";
import { requirePermission } from "../../core/auth";
import * as controller from "./products.controller";

const view = requirePermission("products.view");
const manage = requirePermission("products.manage");

export const productsRoutes = Router();
productsRoutes.get("/", view, controller.list);
productsRoutes.post("/", manage, controller.create);
productsRoutes.get("/:id", view, controller.get);
productsRoutes.patch("/:id", manage, controller.update);
productsRoutes.post("/:id/variants", manage, controller.addVariant);
// The photo is the request body itself (no multipart), capped before it is read.
productsRoutes.post("/:id/images", manage, express.raw({ type: () => true, limit: IMAGE_MAX_BYTES }), controller.uploadImage);
productsRoutes.post("/:id/images/link", manage, controller.linkImage);
productsRoutes.put("/:id/images/order", manage, controller.reorderImages);
productsRoutes.patch("/:id/images/:imageId", manage, controller.updateImage);
productsRoutes.delete("/:id/images/:imageId", manage, controller.removeImage);

export const variantsRoutes = Router();
variantsRoutes.get("/search", view, controller.searchVariants);
variantsRoutes.patch("/:id", manage, controller.updateVariant);
variantsRoutes.put("/:id/tiers", manage, controller.setTiers);
variantsRoutes.get("/:id/price-history", view, controller.priceHistory);
variantsRoutes.put("/:id/mapping", manage, controller.setMapping);

export const pricingRoutes = Router();
pricingRoutes.post("/bulk/preview", manage, controller.previewBulkPrice);
pricingRoutes.post("/bulk/apply", manage, controller.applyBulkPrice);

export const mappingRoutes = Router();
mappingRoutes.get("/", manage, controller.listMappings);
