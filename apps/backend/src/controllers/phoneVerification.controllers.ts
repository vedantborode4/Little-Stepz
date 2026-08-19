import { Request, Response } from "express";
import { sendPhoneOtpSchema, verifyPhoneOtpSchema } from "@repo/zod-schema/index";
import { ApiError, ApiResponse, asyncHandler } from "../utils/api";
import {
  listVerifiedPhones,
  requestPhoneOtpService,
  verifyPhoneOtpService,
} from "../services/phoneVerification.services";

async function sendPhoneOtp(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { phone } = sendPhoneOtpSchema.parse(req.body);

  const result = await requestPhoneOtpService(userId, phone, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  });

  return new ApiResponse(
    200,
    result,
    result.alreadyVerified ? "This number is already verified" : "Verification code sent"
  ).send(res);
}

async function verifyPhoneOtp(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { phone, code } = verifyPhoneOtpSchema.parse(req.body);
  const result = await verifyPhoneOtpService(userId, phone, code);

  return new ApiResponse(200, result, "Phone number verified").send(res);
}

async function getVerifiedPhones(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const phones = await listVerifiedPhones(userId);
  return new ApiResponse(200, { phones }, "Verified phone numbers").send(res);
}

export const sendPhoneOtpController = asyncHandler(sendPhoneOtp);
export const verifyPhoneOtpController = asyncHandler(verifyPhoneOtp);
export const getVerifiedPhonesController = asyncHandler(getVerifiedPhones);
