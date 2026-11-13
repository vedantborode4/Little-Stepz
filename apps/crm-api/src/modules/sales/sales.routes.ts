import { Router } from "express";
import { requireAnyPermission, requirePermission } from "../../core/auth";
import * as controller from "./sales.controller";
import { orderInScope } from "./scope";

const view = requirePermission("sales.view");
const sell = requirePermission("sales.create");
const ship = requireAnyPermission("shipping.manage", "sales.manage");
/** Allocating arrived stock to pre-orders is done by the till or by whoever receives the goods. */
const allocate = requireAnyPermission("sales.create", "inventory.move");

export const salesRoutes = Router();

salesRoutes.get("/", view, controller.list);
salesRoutes.get("/items", sell, controller.items);
salesRoutes.get("/summary", view, controller.summary);
salesRoutes.post("/quote", sell, controller.quote);
salesRoutes.post("/pos", sell, controller.pos);
salesRoutes.post("/", sell, controller.create);
salesRoutes.get("/:id", view, orderInScope, controller.get);
salesRoutes.put("/:id", sell, orderInScope, controller.update);
salesRoutes.post("/:id/confirm", sell, orderInScope, controller.confirm);
salesRoutes.post("/:id/pack", ship, orderInScope, controller.pack);
salesRoutes.post("/:id/fulfil", view, orderInScope, controller.fulfil);
salesRoutes.post("/:id/deliver", ship, orderInScope, controller.deliver);
salesRoutes.post("/:id/cancel", requirePermission("sales.manage"), orderInScope, controller.cancel);
salesRoutes.post("/:id/allocate", allocate, orderInScope, controller.allocate);
salesRoutes.post("/:id/deallocate", requirePermission("sales.manage"), orderInScope, controller.deallocate);
salesRoutes.put("/:id/expected-arrival", sell, orderInScope, controller.expectedArrival);
salesRoutes.put("/:id/salesperson", requirePermission("commission.manage"), orderInScope, controller.setSalesperson);

export const preOrdersRoutes = Router();

preOrdersRoutes.get("/", view, controller.listPreOrders);
preOrdersRoutes.get("/summary", view, controller.preOrderSummary);
preOrdersRoutes.get("/waiting", view, controller.waitingItems);
preOrdersRoutes.post("/allocate-available", allocate, controller.allocateAvailable);
