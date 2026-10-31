import { Router } from "express";
import { requirePermission } from "../../core/auth";
import * as controller from "./audit.controller";

export const auditRoutes = Router();

auditRoutes.get("/", requirePermission("audit.view"), controller.list);
