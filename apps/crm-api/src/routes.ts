import { Router } from "express";
import { authenticate, requirePasswordChanged } from "./core/auth";
import { auditRoutes } from "./modules/audit/audit.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { brandsRoutes, categoriesRoutes } from "./modules/catalog/catalog.routes";
import { customersRoutes } from "./modules/customers/customers.routes";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";
import { mappingRoutes, pricingRoutes, productsRoutes, variantsRoutes } from "./modules/products/products.routes";
import { paymentsRoutes } from "./modules/payments/payments.routes";
import { purchasesRoutes } from "./modules/purchases/purchases.routes";
import { orderReturnsRoutes, returnsRoutes } from "./modules/returns/returns.routes";
import { preOrdersRoutes, salesRoutes } from "./modules/sales/sales.routes";
import { couriersRoutes, shipmentsRoutes } from "./modules/shipping/shipping.routes";
import { cashRoutes } from "./modules/cash/cash.routes";
import { expensesRoutes } from "./modules/expenses/expenses.routes";
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
protectedRoutes.use("/inventory", inventoryRoutes);
protectedRoutes.use("/purchases", purchasesRoutes);
protectedRoutes.use("/customers", customersRoutes);
protectedRoutes.use("/sales/:id/returns", orderReturnsRoutes);
protectedRoutes.use("/sales", salesRoutes);
protectedRoutes.use("/returns", returnsRoutes);
protectedRoutes.use("/shipments", shipmentsRoutes);
protectedRoutes.use("/couriers", couriersRoutes);
protectedRoutes.use("/expenses", expensesRoutes);
protectedRoutes.use("/cash", cashRoutes);
protectedRoutes.use("/pre-orders", preOrdersRoutes);
protectedRoutes.use("/payments", paymentsRoutes);

apiRoutes.use(protectedRoutes);
