import { Router } from "express";
import { requireAnyPermission, requirePermission } from "../../core/auth";
import * as controller from "./sales.controller";

const view = requirePermission("sales.view");
const sell = requirePermission("sales.create");
const ship = requireAnyPermission("shipping.manage", "sales.manage");

export const salesRoutes = Router();

salesRoutes.get("/", view, controller.list);
salesRoutes.get("/items", sell, controller.items);
salesRoutes.get("/summary", view, controller.summary);
salesRoutes.post("/quote", sell, controller.quote);
salesRoutes.post("/pos", sell, controller.pos);
salesRoutes.post("/", sell, controller.create);
salesRoutes.get("/:id", view, controller.get);
salesRoutes.put("/:id", sell, controller.update);
salesRoutes.post("/:id/confirm", sell, controller.confirm);
salesRoutes.post("/:id/pack", ship, controller.pack);
salesRoutes.post("/:id/fulfil", view, controller.fulfil);
salesRoutes.post("/:id/deliver", ship, controller.deliver);
salesRoutes.post("/:id/cancel", requirePermission("sales.manage"), controller.cancel);
