import { Request, Response } from "express"
import { updatePasswordSchema, updateProfileSchema } from "@repo/zod-schema/index"
import {
  getMeService,
  updateMeService,
  updatePasswordService,
} from "../services/user.services"
import { ApiError, ApiResponse, asyncHandler } from "../utils/api"

async function getMe(req: Request, res: Response) {
  if(!req.user)throw new ApiError(401, "Invalid user")
  const userId = req.user.userId

  const user = await getMeService(userId)

  return new ApiResponse(200, user, "User fetched successfully").send(res)
}

async function updateMe(req: Request, res: Response) {
  const parsed = updateProfileSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new ApiError(400, "Invalid request data", parsed.error.flatten().fieldErrors)
  }

  const user = await updateMeService(req.user!.userId, parsed.data)

  return new ApiResponse(200, user, "Profile updated successfully").send(res)
}

async function updatePassword(req: Request, res: Response) {
  const parsed = updatePasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new ApiError(400, "Invalid request data", parsed.error.flatten().fieldErrors)
  }

  await updatePasswordService(req.user!.userId, parsed.data)

  return new ApiResponse(200, null, "Password updated successfully").send(res)
}

export const getMeController = asyncHandler(getMe)
export const updateMeController = asyncHandler(updateMe)
export const updatePasswordController = asyncHandler(updatePassword)
