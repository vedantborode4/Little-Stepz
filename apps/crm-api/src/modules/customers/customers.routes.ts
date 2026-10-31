import { Router } from "express";
import { requirePermission } from "../../core/auth";
import * as controller from "./customers.controller";

const view = requirePermission("customers.view");
const manage = requirePermission("customers.manage");

export const customersRoutes = Router();

customersRoutes.get("/", view, controller.list);
customersRoutes.post("/", manage, controller.create);
customersRoutes.get("/duplicates/check", view, controller.checkDuplicates);
customersRoutes.get("/duplicates", requirePermission("customers.merge"), controller.duplicatePairs);
customersRoutes.get("/:id", view, controller.get);
customersRoutes.patch("/:id", manage, controller.update);
customersRoutes.post("/:id/contact", requirePermission("customers.contact.reveal"), controller.contact);
customersRoutes.post("/:id/merge", requirePermission("customers.merge"), controller.merge);
// Negotiated prices are a pricing decision, so they need catalog rights, not just customer rights.
customersRoutes.put("/:id/prices/:variantId", view, requirePermission("products.manage"), controller.setPrice);
customersRoutes.delete("/:id/prices/:variantId", view, requirePermission("products.manage"), controller.removePrice);
