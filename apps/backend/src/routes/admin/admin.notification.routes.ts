import { Router } from "express";
import {
  adminBroadcastController,
  adminListBroadcastsController,
  adminSearchTargetsController,
} from "../../controllers/admin/admin.notification.controllers";

export const adminNotificationRouter: Router = Router();

adminNotificationRouter.post("/broadcast", adminBroadcastController);
adminNotificationRouter.get("/broadcasts", adminListBroadcastsController);
adminNotificationRouter.get("/search", adminSearchTargetsController);
