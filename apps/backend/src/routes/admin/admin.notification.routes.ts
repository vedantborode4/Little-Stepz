import { Router } from "express";
import { adminBroadcastController } from "../../controllers/admin/admin.notification.controllers";

export const adminNotificationRouter: Router = Router();

adminNotificationRouter.post("/broadcast", adminBroadcastController);
