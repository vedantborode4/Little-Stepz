import { Router } from "express";
import {
    getAdminOrdersController,
    getAdminOrderByIdController,
    updateOrderStatusController,
    reclaimStockController
} from "../../controllers/admin/admin.orders.controllers";
import { isAdmin } from "../../middlewares/role.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";


export const adminOrdersRouter: Router = Router();

adminOrdersRouter.use(authMiddleware, isAdmin);

adminOrdersRouter.get("/", getAdminOrdersController);
adminOrdersRouter.get("/:id", getAdminOrderByIdController);
adminOrdersRouter.put("/:id/status", updateOrderStatusController);
// Run the stale-order sweep on demand. The timer in stockSweeper.services.ts already
// does this every minute; this is the manual lever for when stock looks stuck.
adminOrdersRouter.post("/reclaim-stock", reclaimStockController);