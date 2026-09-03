import { Router } from "express";
import {
    getAdminOrdersController,
    getAdminOrderByIdController,
    updateOrderStatusController,
    reclaimStockController,
    getAdminOrderInvoiceController,
    markBalancePaidController,
    writeOffBalanceController,
    setFulfilmentModeController
} from "../../controllers/admin/admin.orders.controllers";
import { isAdmin } from "../../middlewares/role.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";


export const adminOrdersRouter: Router = Router();

adminOrdersRouter.use(authMiddleware, isAdmin);

adminOrdersRouter.get("/", getAdminOrdersController);
adminOrdersRouter.get("/:id", getAdminOrderByIdController);
adminOrdersRouter.get("/:id/invoice", getAdminOrderInvoiceController);
adminOrdersRouter.put("/:id/status", updateOrderStatusController);
// Local (hand) fulfilment vs Delhivery. Refused while a live waybill exists.
adminOrdersRouter.post("/:id/fulfilment", setFulfilmentModeController);
// Record a partial order's balance as collected outside the gateway — a late COD
// remittance, a bank transfer, or an order delivered without a COD manifest.
adminOrdersRouter.post("/:id/balance/mark-paid", markBalancePaidController);
// Close out a balance that will never be collected, retaining the deposit.
adminOrdersRouter.post("/:id/balance/write-off", writeOffBalanceController);
// Run the stale-order sweep on demand. The timer in stockSweeper.services.ts already
// does this every minute; this is the manual lever for when stock looks stuck.
adminOrdersRouter.post("/reclaim-stock", reclaimStockController);