import { Router } from "express";
import { isAdmin } from "../../middlewares/role.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { adminCategoryRouter } from "./admin.category.routes";
import { adminProductRouter } from "./admin.product.routes";
import { adminReviewRouter } from "./admin.review.routes";
import { adminCouponsRouter } from "./admin.coupons.routes";
import { adminOrdersRouter } from "./admin.orders.routes";
import { adminPaymentRouter } from "./admin.payment.routes";
import { adminAffiliateRouter } from "./admin.affiliate.routes";
import { 
    adminDashboardRouter, 
    adminBannerRouter 
} from "./admin.dashboard.routes";

export const adminRouter: Router = Router();

adminRouter.use(authMiddleware,isAdmin)

adminRouter.use("/categories", adminCategoryRouter)

adminRouter.use("/products", adminProductRouter)

adminRouter.use("/reviews", adminReviewRouter);

adminRouter.use("/coupons",adminCouponsRouter);

adminRouter.use("/orders", adminOrdersRouter);

adminRouter.use("/", adminPaymentRouter);

adminRouter.use("/affiliates", adminAffiliateRouter);

adminRouter.use("/", adminDashboardRouter);

adminRouter.use("/banners", adminBannerRouter);