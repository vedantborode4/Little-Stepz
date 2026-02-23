import { Router } from "express";
import {
  getPublicBannersController,
  trackBannerClickController,
} from "../controllers/admin/admin.dashboard.controllers";

export const bannerRouter: Router = Router();


bannerRouter.get("/", getPublicBannersController);

bannerRouter.post("/:id/click", trackBannerClickController);
