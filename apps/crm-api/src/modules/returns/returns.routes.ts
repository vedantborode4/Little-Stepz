import { Router } from "express";
import { requirePermission } from "../../core/auth";
import * as controller from "./returns.controller";

export const returnsRoutes = Router();

returnsRoutes.get("/", requirePermission("sales.view"), controller.list);
returnsRoutes.get("/:id", requirePermission("sales.view"), controller.get);

/** Mounted on /sales/:id: returns belong to an order. Taking goods back is a correction, so admins only. */
export const orderReturnsRoutes = Router({ mergeParams: true });

orderReturnsRoutes.post("/preview", requirePermission("sales.manage"), controller.preview);
orderReturnsRoutes.post("/", requirePermission("sales.manage"), controller.create);
