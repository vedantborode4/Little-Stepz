import { Router } from "express";
import { authenticate, requirePasswordChanged } from "./core/auth";
import { auditRoutes } from "./modules/audit/audit.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { usersRoutes } from "./modules/users/users.routes";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);

// Everything below requires a signed-in user who has set their own password.
const protectedRoutes = Router();
protectedRoutes.use(authenticate, requirePasswordChanged);
protectedRoutes.use("/users", usersRoutes);
protectedRoutes.use("/settings", settingsRoutes);
protectedRoutes.use("/audit", auditRoutes);

apiRoutes.use(protectedRoutes);
