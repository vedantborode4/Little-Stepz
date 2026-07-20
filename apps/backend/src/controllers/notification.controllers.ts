import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../utils/api";
import {
  registerDeviceService,
  unregisterDeviceService,
  listNotificationsService,
  unreadCountService,
  markReadService,
  markAllReadService,
  getPreferencesService,
  updatePreferencesService,
} from "../services/notification.services";
import {
  registerDeviceBodySchema,
  unregisterDeviceBodySchema,
  notificationListQuerySchema,
  notificationParamsSchema,
  updatePreferencesBodySchema,
} from "@repo/zod-schema/index";

async function registerDevice(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const body = registerDeviceBodySchema.parse(req.body);
  const device = await registerDeviceService(userId, body);
  return new ApiResponse(201, device, "Device registered").send(res);
}

async function unregisterDevice(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const body = unregisterDeviceBodySchema.parse(req.body);
  const result = await unregisterDeviceService(userId, body);
  return new ApiResponse(200, result, "Device unregistered").send(res);
}

async function listNotifications(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const query = notificationListQuerySchema.parse(req.query);
  const result = await listNotificationsService(userId, query);
  return new ApiResponse(200, result, "Notifications fetched").send(res);
}

async function unreadCount(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const result = await unreadCountService(userId);
  return new ApiResponse(200, result, "Unread count fetched").send(res);
}

async function markRead(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const { id } = notificationParamsSchema.parse(req.params);
  const result = await markReadService(userId, id);
  return new ApiResponse(200, result, "Notification marked read").send(res);
}

async function markAllRead(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const result = await markAllReadService(userId);
  return new ApiResponse(200, result, "All notifications marked read").send(res);
}

async function getPreferences(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const result = await getPreferencesService(userId);
  return new ApiResponse(200, result, "Preferences fetched").send(res);
}

async function updatePreferences(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const body = updatePreferencesBodySchema.parse(req.body);
  const result = await updatePreferencesService(userId, body);
  return new ApiResponse(200, result, "Preferences updated").send(res);
}

export const registerDeviceController = asyncHandler(registerDevice);
export const unregisterDeviceController = asyncHandler(unregisterDevice);
export const listNotificationsController = asyncHandler(listNotifications);
export const unreadCountController = asyncHandler(unreadCount);
export const markReadController = asyncHandler(markRead);
export const markAllReadController = asyncHandler(markAllRead);
export const getPreferencesController = asyncHandler(getPreferences);
export const updatePreferencesController = asyncHandler(updatePreferences);
