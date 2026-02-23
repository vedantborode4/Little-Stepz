import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../../utils/api";
import {
  adminStatsQuerySchema,
  createBannerSchema,
  updateBannerSchema,
  bannerParamSchema,
  publicBannersQuerySchema,
} from "@repo/zod-schema/index";
import { adminGetStatsService }  from "../../services/admin/admin.stats.services";
import {
  adminCreateBannerService,
  adminListBannersService,
  adminGetBannerService,
  adminUpdateBannerService,
  adminDeleteBannerService,
  adminToggleBannerService,
  getActiveBannersService,
  recordBannerClickService,
} from "../../services/admin/admin.banner.services";
import { paginationSchema } from "@repo/zod-schema/index";

async function getAdminStats(req: Request, res: Response) {
  const query  = adminStatsQuerySchema.parse(req.query);
  const result = await adminGetStatsService(query);
  return new ApiResponse(200, result, "Dashboard stats fetched").send(res);
}


async function adminCreateBanner(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const validated = createBannerSchema.parse(req.body);
  const result    = await adminCreateBannerService(adminUserId, validated, req);

  return new ApiResponse(201, result, "Banner created").send(res);
}

async function adminListBanners(req: Request, res: Response) {
  const { page, limit } = paginationSchema.parse(req.query);

  const positionRaw = req.query.position;
  const isActiveRaw = req.query.isActive;

  const position =
    typeof positionRaw === "string" &&
    ["HOME_HERO", "HOME_MID", "CATEGORY_TOP", "PRODUCT_SIDEBAR", "CHECKOUT_TOP"].includes(positionRaw)
      ? positionRaw
      : undefined;

  const isActive =
    isActiveRaw === "true"  ? true  :
    isActiveRaw === "false" ? false :
    undefined;

  const result = await adminListBannersService(page, limit, position, isActive);
  return new ApiResponse(200, result, "Banners fetched").send(res);
}

async function adminGetBanner(req: Request, res: Response) {
  const { id } = bannerParamSchema.parse(req.params);
  const result  = await adminGetBannerService(id);
  return new ApiResponse(200, result, "Banner fetched").send(res);
}

async function adminUpdateBanner(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id }    = bannerParamSchema.parse(req.params);
  const validated = updateBannerSchema.parse(req.body);
  const result    = await adminUpdateBannerService(adminUserId, id, validated, req);

  return new ApiResponse(200, result, "Banner updated").send(res);
}

async function adminDeleteBanner(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id } = bannerParamSchema.parse(req.params);
  const result  = await adminDeleteBannerService(adminUserId, id, req);

  return new ApiResponse(200, result, "Banner deleted").send(res);
}

async function adminToggleBanner(req: Request, res: Response) {
  const adminUserId = req.user?.userId;
  if (!adminUserId) throw new ApiError(401, "Unauthorized");

  const { id } = bannerParamSchema.parse(req.params);
  const result  = await adminToggleBannerService(adminUserId, id, req);

  return new ApiResponse(200, result, `Banner ${result.isActive ? "activated" : "deactivated"}`).send(res);
}


async function getPublicBanners(req: Request, res: Response) {
  const query    = publicBannersQuerySchema.parse(req.query);
  const userRole = req.user?.role;           // undefined for unauthenticated
  const result   = await getActiveBannersService(query, userRole);

  return new ApiResponse(200, result, "Banners fetched").send(res);
}

async function trackBannerClick(req: Request, res: Response) {
  const { id } = bannerParamSchema.parse(req.params);
  recordBannerClickService(id); // fire-and-forget
  return new ApiResponse(200, { tracked: true }, "Click recorded").send(res);
}

export const getAdminStatsController    = asyncHandler(getAdminStats);
export const adminCreateBannerController = asyncHandler(adminCreateBanner);
export const adminListBannersController  = asyncHandler(adminListBanners);
export const adminGetBannerController    = asyncHandler(adminGetBanner);
export const adminUpdateBannerController = asyncHandler(adminUpdateBanner);
export const adminDeleteBannerController = asyncHandler(adminDeleteBanner);
export const adminToggleBannerController = asyncHandler(adminToggleBanner);
export const getPublicBannersController  = asyncHandler(getPublicBanners);
export const trackBannerClickController  = asyncHandler(trackBannerClick);