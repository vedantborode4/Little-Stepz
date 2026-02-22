import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  applyAffiliateController,
  getAffiliateMeController,
  getReferralLinkController,
  handleReferralClickController,
  getAffiliateStatsController,
  getAffiliateClicksController,
  getAffiliateConversionsController,
  getAffiliateCommissionsController,
  getAffiliateOrdersController,
  updatePayoutDetailsController,
  requestWithdrawalController,
} from "../controllers/affiliate.controllers";
import {
  referralClickRateLimiter,
  withdrawalRateLimiter,
} from "../middlewares/affiliateRateLimiter.middleware";



export const affiliateRouter: Router = Router();

affiliateRouter.get(
  "/ref/:referralCode",
  referralClickRateLimiter,
  handleReferralClickController
);

affiliateRouter.use(authMiddleware);

affiliateRouter.post("/apply", applyAffiliateController);

affiliateRouter.get("/me", getAffiliateMeController);

affiliateRouter.get("/referral-link", getReferralLinkController);

affiliateRouter.get("/stats", getAffiliateStatsController);

affiliateRouter.get("/clicks", getAffiliateClicksController);

affiliateRouter.get("/conversions", getAffiliateConversionsController);

affiliateRouter.get("/commissions", getAffiliateCommissionsController);

affiliateRouter.get("/orders", getAffiliateOrdersController);

affiliateRouter.put("/payout-details", updatePayoutDetailsController);

affiliateRouter.post("/withdraw", withdrawalRateLimiter, requestWithdrawalController);
