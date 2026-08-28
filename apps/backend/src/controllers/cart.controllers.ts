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
import { createAuditLog } from "../utils/auditLog";
import { verifyAccessToken } from "../utils/auth/access-token";

/**
 * Who is adding to the cart, for the audit trail only.
 *
 * The cart router deliberately does NOT run authMiddleware — carts work for signed-out
 * visitors, and the session-to-user merge happens on POST /cart/sync. That leaves
 * `req.user` unset even when the caller sent a valid token, so an audit row keyed on
 * it would label every signed-in customer a guest.
 *
 * Reading the token here restores the identity for logging without touching
 * `req.cartIdentifier`, so cart behaviour is unchanged. Failure is silent: an
 * expired or malformed token simply means the event is recorded as a guest, which
 * is exactly what it is from the cart's point of view.
 */
function auditUserId(req: Request): string | undefined {
  if (req.user?.userId) return req.user.userId;
  const token =
    req.cookies?.accessToken || req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return undefined;
  try {
    return verifyAccessToken(token).userId;
  } catch {
    return undefined;
  }
}
import { setCartSession } from "../middlewares/cart.middleware";

async function getCart(req: Request, res: Response) {
  const identifier = req.cartIdentifier
  if (!identifier) throw new ApiError(500, "Internal error")

  const userId = req.user?.userId

  // ⭐ AUTO SYNC FLOW
  if (userId && identifier.type === "session") {
    await syncCartService(userId, identifier.id)

    // rotate session (prevent fixation)
    setCartSession(req, res, randomUUID())

    const userIdentifier = { type: "user" as const, id: userId }
    const cart = await getCartService(userIdentifier)

    return new ApiResponse(200, cart, "Cart fetched").send(res)
  }

  const cart = await getCartService(identifier)

  return new ApiResponse(200, cart, "Cart fetched").send(res)
}


async function addCartItem(req: Request, res: Response) {
  const identifier = req.cartIdentifier;
  if (!identifier) throw new ApiError(500, "Internal error");
  const validated = addCartItemBodySchema.parse(req.body);
  await addCartItemService(identifier, validated);

  // Fire-and-forget: an audit write must never turn a successful add into an error.
  // Logged after the add succeeds, so the trail contains only real events.
  // Guests are captured too (userId null, sessionId in metadata) — the cart accepts
  // a session identifier, so restricting this to signed-in users would miss exactly
  // the traffic worth investigating. `req` supplies ip + user-agent.
  void createAuditLog({
    userId: auditUserId(req),
    action: "CART_ITEM_ADDED",
    entity: "CartItem",
    entityId: validated.productId,
    newValue: {
      productId: validated.productId,
      variantId: validated.variantId ?? null,
      quantity: validated.quantity,
    },
    metadata: identifier.type === "session" ? { sessionId: identifier.id } : {},
    req,
  });

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
  // Rotate to a new session id after sync to prevent fixation
  res.clearCookie("cartSession");
  setCartSession(req, res, randomUUID());
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