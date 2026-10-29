import { Router } from "express";
import { requirePermission } from "../../core/auth";
import * as controller from "./inventory.controller";

const view = requirePermission("inventory.view");
const move = requirePermission("inventory.move");
const adjust = requirePermission("inventory.adjust");

export const inventoryRoutes = Router();

inventoryRoutes.get("/stock", view, controller.listStock);
inventoryRoutes.get("/summary", view, controller.summary);
inventoryRoutes.get("/ledger", view, controller.listLedger);
inventoryRoutes.get("/documents/:id", view, controller.getDocument);
inventoryRoutes.get("/variants/:id", view, controller.variantCard);

inventoryRoutes.post("/transfers", move, controller.transfer);
inventoryRoutes.post("/status-changes", move, controller.bucketMove);

inventoryRoutes.post("/opening", adjust, controller.opening);
inventoryRoutes.post("/write-offs", adjust, controller.writeOff);
inventoryRoutes.post("/adjustments", adjust, controller.adjust);
inventoryRoutes.post("/documents/:id/reverse", adjust, controller.reverse);
