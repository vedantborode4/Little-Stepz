import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../utils/api";
import {
  affiliateApplySchema,
  affiliatePayoutDetailsSchema,
  affiliateWithdrawSchema,
  affiliateClicksQuerySchema,
  affiliateConversionsQuerySchema,
  affiliateCommissionsQuerySchema,
  affiliateOrdersQuerySchema,
  referralCodeParamSchema,
  adminAffiliateApproveSchema,
  adminProcessWithdrawalSchema,
  
} from "@repo/zod-schema/index";
import {
  applyForAffiliateService,
  getAffiliateProfileService,
  getReferralLinkService,
  trackReferralClickService,
  trackClickPublicService,
  getAffiliateStatsService,
  getAffiliateClicksService,
  getAffiliateConversionsService,
  getAffiliateCommissionsService,
  getAffiliateOrdersService,
  updatePayoutDetailsService,
  requestWithdrawalService,
  adminApproveAffiliateService,
  adminListAffiliatesService,
  adminProcessWithdrawalService,
  adminListWithdrawalsService,
} from "../services/affiliate.services";
import { paginationSchema } from "@repo/zod-schema/index";

async function applyAffiliate(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  // Extract message before schema validation (schema may not include it)
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : undefined;

  // Validate the rest of the body with the schema (strip unknown keys)
  const { message: _msg, ...rest } = req.body ?? {};
  const validated = { ...affiliateApplySchema.parse(rest), ...(message ? { message } : {}) };

  const result = await applyForAffiliateService(userId, validated as any, req);

  return new ApiResponse(201, result, "Affiliate application submitted").send(res);
}


async function getAffiliateMe(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const result = await getAffiliateProfileService(userId);
  return new ApiResponse(200, result, "Affiliate profile fetched").send(res);
}

async function getReferralLink(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const result = await getReferralLinkService(userId);
  return new ApiResponse(200, result, "Referral link fetched").send(res);
}

async function handleReferralClick(req: Request, res: Response) {
  const { referralCode } = referralCodeParamSchema.parse(req.params);

  const { redirectUrl, cookieOptions } = await trackReferralClickService(
    referralCode.toUpperCase(),
    req
  );

  res.cookie(cookieOptions.name, cookieOptions.value, {
    maxAge:   cookieOptions.maxAge * 1000, // convert to ms
    httpOnly: cookieOptions.httpOnly,
    sameSite: cookieOptions.sameSite,
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
  });

  return res.redirect(302, redirectUrl);
}

async function trackClickPublic(req: Request, res: Response) {
  const { referralCode } = req.body;
  if (!referralCode || typeof referralCode !== "string") {
    throw new ApiError(400, "referralCode is required");
  }
  const result = await trackClickPublicService(referralCode.toUpperCase(), req);
  return new ApiResponse(200, result, "Click tracked").send(res);
}

async function getAffiliateStats(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const result = await getAffiliateStatsService(userId);
  return new ApiResponse(200, result, "Affiliate stats fetched").send(res);
}

async function getAffiliateClicks(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const query  = affiliateClicksQuerySchema.parse(req.query);
  const result = await getAffiliateClicksService(userId, query);

  return new ApiResponse(200, result, "Clicks fetched").send(res);
}

async function getAffiliateConversions(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const query  = affiliateConversionsQuerySchema.parse(req.query);
  const result = await getAffiliateConversionsService(userId, query);

  return new ApiResponse(200, result, "Conversions fetched").send(res);
}

async function getAffiliateCommissions(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const query  = affiliateCommissionsQuerySchema.parse(req.query);
  const result = await getAffiliateCommissionsService(userId, query);

  return new ApiResponse(200, result, "Commissions fetched").send(res);
}

async function getAffiliateOrders(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const query  = affiliateOrdersQuerySchema.parse(req.query);
  const result = await getAffiliateOrdersService(userId, query);

  return new ApiResponse(200, result, "Affiliate orders fetched").send(res);
}

async function updatePayoutDetails(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const validated = affiliatePayoutDetailsSchema.parse(req.body);
  const result    = await updatePayoutDetailsService(userId, validated, req);

  return new ApiResponse(200, result, "Payout details updated").send(res);
}

async function requestWithdrawal(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const validated = affiliateWithdrawSchema.parse(req.body);
  const result    = await requestWithdrawalService(userId, validated, req);

  return new ApiResponse(201, result, "Withdrawal request submitted").send(res);
}


async function adminListAffiliates(req: Request, res: Response) {
  const { status } = req.query;
  const { page, limit } = paginationSchema.parse(req.query);

  const result = await adminListAffiliatesService(status as string | undefined, page, limit);
  return new ApiResponse(200, result, "Affiliates fetched").send(res);
}

async function adminApproveAffiliate(req: Request, res: Response) {
  const adminUserId   = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id: affiliateId } = req.params;
  if (!affiliateId) throw new ApiError(400, "Affiliate ID required");

  const validated = adminAffiliateApproveSchema.parse(req.body);
  const result    = await adminApproveAffiliateService(adminUserId, affiliateId, validated, req);

  return new ApiResponse(200, result, `Affiliate ${validated.status.toLowerCase()}`).send(res);
}

async function adminListWithdrawals(req: Request, res: Response) {
  const { status } = req.query;
  const { page, limit } = paginationSchema.parse(req.query);

  const result = await adminListWithdrawalsService(status as string | undefined, page, limit);
  return new ApiResponse(200, result, "Withdrawals fetched").send(res);
}

async function adminProcessWithdrawal(req: Request, res: Response) {
  const adminUserId    = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id: withdrawalId } = req.params;
  if (!withdrawalId) throw new ApiError(400, "Withdrawal ID required");

  const validated = adminProcessWithdrawalSchema.parse(req.body);
  const result    = await adminProcessWithdrawalService(adminUserId, withdrawalId, validated, req);

  return new ApiResponse(200, result, `Withdrawal ${validated.status.toLowerCase()}`).send(res);
}

export const applyAffiliateController        = asyncHandler(applyAffiliate);
export const getAffiliateMeController        = asyncHandler(getAffiliateMe);
export const getReferralLinkController       = asyncHandler(getReferralLink);
export const handleReferralClickController   = asyncHandler(handleReferralClick);
export const trackClickPublicController      = asyncHandler(trackClickPublic);
export const getAffiliateStatsController     = asyncHandler(getAffiliateStats);
export const getAffiliateClicksController    = asyncHandler(getAffiliateClicks);
export const getAffiliateConversionsController = asyncHandler(getAffiliateConversions);
export const getAffiliateCommissionsController = asyncHandler(getAffiliateCommissions);
export const getAffiliateOrdersController    = asyncHandler(getAffiliateOrders);
export const updatePayoutDetailsController   = asyncHandler(updatePayoutDetails);
export const requestWithdrawalController     = asyncHandler(requestWithdrawal);
export const adminListAffiliatesController   = asyncHandler(adminListAffiliates);
export const adminApproveAffiliateController = asyncHandler(adminApproveAffiliate);
export const adminListWithdrawalsController  = asyncHandler(adminListWithdrawals);
export const adminProcessWithdrawalController = asyncHandler(adminProcessWithdrawal);
