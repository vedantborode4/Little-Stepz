import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import {
  adminCommissionsQuerySchema,
  adminApproveCommissionSchema,
  adminPayCommissionSchema,
  adminAffiliateDetailParamSchema,
} from "@repo/zod-schema/index"
import {
  adminListCommissionsService,
  adminApproveCommissionService,
  adminPayCommissionService,
  adminGetAffiliateDetailService,
  adminApproveAffiliateOnlyService,
  adminRejectAffiliateService,
  adminUpdateAffiliateService,
} from "../../services/admin/admin.affiliate.services";
import { adminListAffiliatesService } from "../../services/affiliate.services";
import { z } from "zod";
import { paginationSchema } from "@repo/zod-schema/index";

async function listAffiliates(req: Request, res: Response) {
  const { status } = req.query;
  const { page, limit } = paginationSchema.parse(req.query);

  const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
  const statusFilter  = typeof status === "string" && validStatuses.includes(status) ? status : undefined;

  const result = await adminListAffiliatesService(statusFilter, page, limit);
  return new ApiResponse(200, result, "Affiliates fetched").send(res);
}

async function approveAffiliate(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id: affiliateId } = req.params;
  if (!affiliateId) throw new ApiError(400, "Affiliate ID required");

  const body = z
    .object({
      commissionRate: z.number().min(0.01).max(0.20).optional(),
      commissionType: z.enum(["PER_ORDER", "LIFETIME"]).optional(),
      adminNote:      z.string().max(500).optional(),
    })
    .strict()
    .parse(req.body);

  const result = await adminApproveAffiliateOnlyService(
    adminUserId,
    affiliateId,
    body.commissionRate,
    body.commissionType,
    body.adminNote,
    req
  );

  return new ApiResponse(200, result, "Affiliate approved").send(res);
}

async function rejectAffiliate(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id: affiliateId } = req.params;
  if (!affiliateId) throw new ApiError(400, "Affiliate ID required");

  const body = z
    .object({ adminNote: z.string().max(500).optional() })
    .strict()
    .parse(req.body);

  const result = await adminRejectAffiliateService(adminUserId, affiliateId, body.adminNote, req);
  return new ApiResponse(200, result, "Affiliate rejected").send(res);
}

async function getAffiliateDetail(req: Request, res: Response) {
  const { id } = adminAffiliateDetailParamSchema.parse(req.params);
  const result  = await adminGetAffiliateDetailService(id);
  return new ApiResponse(200, result, "Affiliate details fetched").send(res);
}

async function listCommissions(req: Request, res: Response) {
  const query  = adminCommissionsQuerySchema.parse(req.query);
  const result = await adminListCommissionsService(query);
  return new ApiResponse(200, result, "Commissions fetched").send(res);
}

async function approveCommission(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id: commissionId } = req.params;
  if (!commissionId) throw new ApiError(400, "Commission ID required");

  const body   = adminApproveCommissionSchema.parse(req.body);
  const result = await adminApproveCommissionService(adminUserId, commissionId, body, req);

  return new ApiResponse(200, result, "Commission approved").send(res);
}

async function payCommission(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id: commissionId } = req.params;
  if (!commissionId) throw new ApiError(400, "Commission ID required");

  const body   = adminPayCommissionSchema.parse(req.body);
  const result = await adminPayCommissionService(adminUserId, commissionId, body, req);

  return new ApiResponse(200, result, "Commission marked as paid").send(res);
}


async function updateAffiliate(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id: affiliateId } = req.params;
  if (!affiliateId) throw new ApiError(400, "Affiliate ID required");

  const body = z
    .object({
      commissionRate: z.number().min(0.01).max(0.20).optional(),
      commissionType: z.enum(["PER_ORDER", "LIFETIME"]).optional(),
      adminNote:      z.string().max(500).optional(),
    })
    .parse(req.body);

  const result = await adminUpdateAffiliateService(adminUserId, affiliateId, body, req);
  return new ApiResponse(200, result, "Affiliate updated").send(res);
}

export const adminListAffiliatesController    = asyncHandler(listAffiliates);
export const adminApproveAffiliateController  = asyncHandler(approveAffiliate);
export const adminRejectAffiliateController   = asyncHandler(rejectAffiliate);
export const adminGetAffiliateDetailController = asyncHandler(getAffiliateDetail);
export const adminListCommissionsController   = asyncHandler(listCommissions);
export const adminApproveCommissionController = asyncHandler(approveCommission);
export const adminPayCommissionController     = asyncHandler(payCommission);
export const adminUpdateAffiliateController = asyncHandler(updateAffiliate);