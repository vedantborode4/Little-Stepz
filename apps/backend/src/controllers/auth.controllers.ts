import { Request, Response } from "express";
import { SignupSchema } from "@repo/zod-schema/index";
import {  signupService } from "../services/auth.services";
import {
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "../utils/constants";



export async function signupController(req: Request, res: Response) {
  try {
    const parsed = SignupSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid request data",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { user, accessToken, refreshToken } =
      await signupService(parsed.data);

    res.cookie("accessToken", accessToken, accessTokenCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

    return res.status(201).json({ user });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).json({ message: err.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}
