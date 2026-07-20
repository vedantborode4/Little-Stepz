import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  registerDeviceController,
  unregisterDeviceController,
  listNotificationsController,
  unreadCountController,
  markReadController,
  markAllReadController,
  getPreferencesController,
  updatePreferencesController,
} from "../controllers/notification.controllers";

export const notificationRouter: Router = Router();

notificationRouter.use(authMiddleware);

notificationRouter.post("/devices", registerDeviceController);
notificationRouter.delete("/devices", unregisterDeviceController);

notificationRouter.get("/preferences", getPreferencesController);
notificationRouter.patch("/preferences", updatePreferencesController);

notificationRouter.get("/", listNotificationsController);
notificationRouter.get("/unread-count", unreadCountController);
notificationRouter.patch("/read-all", markAllReadController);
notificationRouter.patch("/:id/read", markReadController);
