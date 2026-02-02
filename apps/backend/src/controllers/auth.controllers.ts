import { Request, Response } from "express";
import { SigninSchema, SignupSchema } from "@repo/zod-schema/index";
import {  logoutService, refreshService, signinService, signupService } from "../services/auth.services";
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

export async function signinController(req: Request, res: Response) {
  try {
    const parsed = SigninSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid request data",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { user, accessToken, refreshToken } =
      await signinService(parsed.data);

    res.cookie("accessToken", accessToken, accessTokenCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

    return res.status(200).json({ user });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(401).json({ message: err.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function logoutController(req: Request, res: Response) {
  try {
    const { refreshToken } = req.cookies;

    // idempotent logout
    if (refreshToken) {
      await logoutService(refreshToken);
    }

    res.clearCookie("accessToken", accessTokenCookieOptions);
    res.clearCookie("refreshToken", refreshTokenCookieOptions);

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).json({ message: err.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}


export async function refreshController(req: Request, res: Response) {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token required" });
    }

    const {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    } = await refreshService(refreshToken);

    res.cookie("accessToken", newAccessToken, accessTokenCookieOptions);
    res.cookie("refreshToken", newRefreshToken, refreshTokenCookieOptions);

    return res.status(200).json({ message: "Token refreshed" });
  } catch (err) {
    // includes reuse detection → revoke all tokens inside service
    if (err instanceof Error) {
      res.clearCookie("accessToken", accessTokenCookieOptions);
      res.clearCookie("refreshToken", refreshTokenCookieOptions);
      return res.status(401).json({ message: err.message });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
}
