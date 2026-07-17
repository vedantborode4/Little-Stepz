import { Router } from "express";
import {
  getAdminStatsController,
  getPnlController,
  adminCreateBannerController,
  adminListBannersController,
  adminGetBannerController,
  adminUpdateBannerController,
  adminDeleteBannerController,
  adminToggleBannerController,
} from "../../controllers/admin/admin.dashboard.controllers";

export const adminDashboardRouter: Router = Router();
export const adminBannerRouter: Router    = Router();


adminDashboardRouter.get("/stats", getAdminStatsController);
adminDashboardRouter.get("/pnl", getPnlController);

adminBannerRouter.post("/",          adminCreateBannerController);

adminBannerRouter.get("/",           adminListBannersController);

adminBannerRouter.get("/:id",        adminGetBannerController);

adminBannerRouter.put("/:id",        adminUpdateBannerController);

adminBannerRouter.delete("/:id",     adminDeleteBannerController);

adminBannerRouter.patch("/:id/toggle", adminToggleBannerController);
