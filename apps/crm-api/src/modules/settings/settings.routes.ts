import { Router } from "express";
import { requirePermission } from "../../core/auth";
import * as controller from "./settings.controller";

/** Reads are open to every signed-in role (receipts, stock and payment forms need them). */
export const settingsRoutes = Router();

const manage = requirePermission("settings.manage");

settingsRoutes.get("/business-profile", controller.getBusinessProfile);
settingsRoutes.put("/business-profile", manage, controller.saveBusinessProfile);

settingsRoutes.get("/locations", controller.listLocations);
settingsRoutes.post("/locations", manage, controller.createLocation);
settingsRoutes.patch("/locations/:id", manage, controller.updateLocation);

settingsRoutes.get("/receiving-accounts", controller.listReceivingAccounts);
settingsRoutes.post("/receiving-accounts", manage, controller.createReceivingAccount);
settingsRoutes.patch("/receiving-accounts/:id", manage, controller.updateReceivingAccount);
