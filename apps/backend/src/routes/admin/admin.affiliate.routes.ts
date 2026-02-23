import { Router } from "express";
import {
  adminListAffiliatesController,
  adminApproveAffiliateController,
  adminRejectAffiliateController,
  adminGetAffiliateDetailController,
  adminListCommissionsController,
  adminApproveCommissionController,
  adminPayCommissionController,
} from "../../controllers/admin/admin.affiliate.controllers";
import {
  adminListWithdrawalsController,
  adminProcessWithdrawalController,
} from "../../controllers/affiliate.controllers";

export const adminAffiliateRouter: Router = Router();


adminAffiliateRouter.get("/", adminListAffiliatesController);

adminAffiliateRouter.put("/:id/resolve", adminApproveAffiliateController);

adminAffiliateRouter.get("/withdrawals", adminListWithdrawalsController);

adminAffiliateRouter.put("/withdrawals/:id/process", adminProcessWithdrawalController);

adminAffiliateRouter.get("/:id/details", adminGetAffiliateDetailController);

adminAffiliateRouter.put("/:id/approve", adminApproveAffiliateController);

adminAffiliateRouter.put("/:id/reject", adminRejectAffiliateController);

adminAffiliateRouter.get("/commissions", adminListCommissionsController);

adminAffiliateRouter.put("/commissions/:id/approve", adminApproveCommissionController);

adminAffiliateRouter.put("/commissions/:id/pay", adminPayCommissionController);
