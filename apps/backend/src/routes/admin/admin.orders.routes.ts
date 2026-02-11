import { Router } from "express";
import { 
    getAdminOrdersController, 
    updateOrderStatusController 
} from "../../controllers/admin/admin.orders.controllers";
import { isAdmin } from "../../middlewares/role.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";


export const adminOrdersRouter: Router = Router();

adminOrdersRouter.use(authMiddleware, isAdmin);

adminOrdersRouter.get("/", getAdminOrdersController);
adminOrdersRouter.put("/:id/status", updateOrderStatusController);