import { Router } from "express";
import { requirePermission } from "../../core/auth";
import * as controller from "./users.controller";

export const usersRoutes = Router();

usersRoutes.use(requirePermission("users.manage"));
usersRoutes.get("/", controller.list);
usersRoutes.post("/", controller.create);
usersRoutes.patch("/:id", controller.update);
usersRoutes.post("/:id/reset-password", controller.resetPassword);
