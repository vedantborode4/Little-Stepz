// src/controllers/cart.controllers.ts
import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../utils/api";
import {
  getCartService,
  addCartItemService,
  updateCartItemService,
  removeCartItemService,
  clearCartService,
  syncCartService,
} from "../services/cart.services";
import {
  addCartItemBodySchema,
  updateCartItemBodySchema,
  removeCartItemBodySchema,
  syncCartBodySchema,
} from "@repo/zod-schema/index";
import { randomUUID } from "crypto";

async function getCart(req: Request, res: Response) {
  const identifier = req.cartIdentifier;
  if (!identifier) throw new ApiError(500, "Internal error");
  const cart = await getCartService(identifier);
  return new ApiResponse(200, cart, "Cart fetched").send(res);
}

async function addCartItem(req: Request, res: Response) {
  const identifier = req.cartIdentifier;
  if (!identifier) throw new ApiError(500, "Internal error");
  const validated = addCartItemBodySchema.parse(req.body);
  await addCartItemService(identifier, validated);
  const updatedCart = await getCartService(identifier);
  return new ApiResponse(201, updatedCart, "Item added to cart").send(res);
}

async function updateCartItem(req: Request, res: Response) {
  const identifier = req.cartIdentifier;
  if (!identifier) throw new ApiError(500, "Internal error");
  const validated = updateCartItemBodySchema.parse(req.body);
  await updateCartItemService(identifier, validated);
  const updatedCart = await getCartService(identifier);
  return new ApiResponse(200, updatedCart, "Cart item updated").send(res);
}

async function removeCartItem(req: Request, res: Response) {
  const identifier = req.cartIdentifier;
  if (!identifier) throw new ApiError(500, "Internal error");
  const validated = removeCartItemBodySchema.parse(req.body);
  await removeCartItemService(identifier, validated);
  const updatedCart = await getCartService(identifier);
  return new ApiResponse(200, updatedCart, "Item removed from cart").send(res);
}

async function clearCart(req: Request, res: Response) {
  const identifier = req.cartIdentifier;
  if (!identifier) throw new ApiError(500, "Internal error");
  await clearCartService(identifier);
  const updatedCart = await getCartService(identifier);
  return new ApiResponse(200, updatedCart, "Cart cleared").send(res);
}

async function syncCart(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");
  const validated = syncCartBodySchema.parse(req.body);
  if (!validated.sessionId) throw new ApiError(400, "Session ID required");
  await syncCartService(userId, validated.sessionId);
  // Clear session cookie after sync
  res.clearCookie("cartSession");
  // Rotate to new session ID to prevent fixation
  const newSessionId = randomUUID();
  res.cookie('cartSession', newSessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  const userIdentifier = { type: "user" as const, id: userId };
  const updatedCart = await getCartService(userIdentifier);
  return new ApiResponse(200, updatedCart, "Cart synced").send(res);
}

export const getCartController = asyncHandler(getCart);
export const addCartItemController = asyncHandler(addCartItem);
export const updateCartItemController = asyncHandler(updateCartItem);
export const removeCartItemController = asyncHandler(removeCartItem);
export const clearCartController = asyncHandler(clearCart);
export const syncCartController = asyncHandler(syncCart);