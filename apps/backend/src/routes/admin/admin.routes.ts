import { Router } from "express";
import { isAdmin } from "../../middlewares/role.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { adminCategoryRouter } from "./admin.category.routes";

export const adminRouter: Router = Router();

adminRouter.use(authMiddleware,isAdmin)

adminRouter.use("/categories", adminCategoryRouter)