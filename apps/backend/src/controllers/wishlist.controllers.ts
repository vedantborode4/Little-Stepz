import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../utils/api";
import {
  getWishlistService,
  addToWishlistService,
  removeFromWishlistService,
} from "../services/wishlist.services";
import { addWishlistItemBodySchema, removeWishlistItemParamsSchema } from "@repo/zod-schema/index";

async function getWishlist(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  
  const wishlist = await getWishlistService(userId);
  return new ApiResponse(200, wishlist, "Wishlist fetched").send(res);
}

async function addToWishlist(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  
  const validated = addWishlistItemBodySchema.parse(req.body);
  const result = await addToWishlistService(userId, validated.productId);
  return new ApiResponse(201, result, "Added to wishlist").send(res);
}

async function removeFromWishlist(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  
  const { productId } = removeWishlistItemParamsSchema.parse(req.params);
  await removeFromWishlistService(userId, productId);
  return new ApiResponse(200, null, "Removed from wishlist").send(res);
}

export const getWishlistController = asyncHandler(getWishlist);
export const addToWishlistController = asyncHandler(addToWishlist);
export const removeFromWishlistController = asyncHandler(removeFromWishlist);