import { Request, Response } from "express";
import { guestCheckoutStartSchema, guestCheckoutVerifySchema } from "@repo/zod-schema/index";
import { ApiResponse, asyncHandler } from "../utils/api";
import { startGuestCheckoutService, verifyGuestCheckoutService } from "../services/guestCheckout.services";

async function startGuestCheckout(req: Request, res: Response) {
  const input = guestCheckoutStartSchema.parse(req.body);
  const result = await startGuestCheckoutService(input, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  });
  return new ApiResponse(200, result, "Verification code sent").send(res);
}

async function verifyGuestCheckout(req: Request, res: Response) {
  const input = guestCheckoutVerifySchema.parse(req.body);
  const result = await verifyGuestCheckoutService(input);
  return new ApiResponse(200, result, "Phone number verified").send(res);
}

export const startGuestCheckoutController = asyncHandler(startGuestCheckout);
export const verifyGuestCheckoutController = asyncHandler(verifyGuestCheckout);
