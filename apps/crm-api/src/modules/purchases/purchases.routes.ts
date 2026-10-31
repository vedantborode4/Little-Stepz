import { Router } from "express";
import { requirePermission } from "../../core/auth";
import * as controller from "./purchases.controller";

const view = requirePermission("purchases.view");
const manage = requirePermission("purchases.manage");
const receive = requirePermission("purchases.receive");

export const purchasesRoutes = Router();

purchasesRoutes.get("/", view, controller.list);
purchasesRoutes.get("/last-rate", manage, controller.lastRate);
purchasesRoutes.post("/preview", manage, controller.preview);
purchasesRoutes.post("/", manage, controller.create);
purchasesRoutes.get("/:id", view, controller.get);
purchasesRoutes.put("/:id", manage, controller.update);
purchasesRoutes.post("/:id/cancel", manage, controller.cancel);
purchasesRoutes.post("/:id/receive", receive, controller.receive);
purchasesRoutes.post("/:id/late-charges", manage, controller.lateCharge);
purchasesRoutes.post("/:id/returns", manage, controller.returnGoods);
