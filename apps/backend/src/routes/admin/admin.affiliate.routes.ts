import { Router } from "express";
import {
  adminListAffiliatesController,
  adminApproveAffiliateController,
  adminListWithdrawalsController,
  adminProcessWithdrawalController,
} from "../../controllers/affiliate.controllers";

export const adminAffiliateRouter: Router = Router();


adminAffiliateRouter.get("/", adminListAffiliatesController);

adminAffiliateRouter.put("/:id/resolve", adminApproveAffiliateController);

adminAffiliateRouter.get("/withdrawals", adminListWithdrawalsController);

adminAffiliateRouter.put("/withdrawals/:id/process", adminProcessWithdrawalController);
