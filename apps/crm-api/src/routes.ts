import { Router } from "express";
import { authenticate, requirePasswordChanged } from "./core/auth";
import { auditRoutes } from "./modules/audit/audit.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { brandsRoutes, categoriesRoutes } from "./modules/catalog/catalog.routes";
import { mappingRoutes, pricingRoutes, productsRoutes, variantsRoutes } from "./modules/products/products.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { suppliersRoutes } from "./modules/suppliers/suppliers.routes";
import { usersRoutes } from "./modules/users/users.routes";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);

// Everything below requires a signed-in user who has set their own password.
const protectedRoutes = Router();
protectedRoutes.use(authenticate, requirePasswordChanged);
protectedRoutes.use("/users", usersRoutes);
protectedRoutes.use("/settings", settingsRoutes);
protectedRoutes.use("/audit", auditRoutes);
protectedRoutes.use("/categories", categoriesRoutes);
protectedRoutes.use("/brands", brandsRoutes);
protectedRoutes.use("/suppliers", suppliersRoutes);
protectedRoutes.use("/products", productsRoutes);
protectedRoutes.use("/variants", variantsRoutes);
protectedRoutes.use("/pricing", pricingRoutes);
protectedRoutes.use("/website-mapping", mappingRoutes);

apiRoutes.use(protectedRoutes);
