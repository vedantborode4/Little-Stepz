import { Request, Response } from "express";
import {
  forgotPasswordSchema,
  GoogleAuthSchema,
  resetPasswordSchema,
  SigninSchema,
  SignupSchema,
  verifyResetCodeSchema,
} from "@repo/zod-schema/index";
import {
  googleAuthService,
  logoutService,
  refreshService,
  requestPasswordResetService,
  resetPasswordService,
  signinService,
  signupService,
  verifyResetCodeService,
} from "../services/auth.services";
import { ApiError, ApiResponse, asyncHandler } from "../utils/api";
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

    return res.status(201).json({ user, accessToken });
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

    return res.status(200).json({ user, accessToken });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(401).json({ message: err.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function googleController(req: Request, res: Response) {
  try {
    const parsed = GoogleAuthSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid request data",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { user, accessToken, refreshToken } =
      await googleAuthService(parsed.data.idToken, parsed.data.referralCode);

    res.cookie("accessToken", accessToken, accessTokenCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

    return res.status(200).json({ user, accessToken });
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


const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, we've sent a reset code and link.";

async function forgotPassword(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid request data", parsed.error.flatten().fieldErrors);
  }

  await requestPasswordResetService(parsed.data.email, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  });

  // identical response whether or not the account exists
  return new ApiResponse(200, null, GENERIC_RESET_MESSAGE).send(res);
}

async function verifyResetCode(req: Request, res: Response) {
  const parsed = verifyResetCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid request data", parsed.error.flatten().fieldErrors);
  }

  const data = await verifyResetCodeService(parsed.data.email, parsed.data.code);

  return new ApiResponse(200, data, "Code verified").send(res);
}

async function resetPassword(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid request data", parsed.error.flatten().fieldErrors);
  }

  await resetPasswordService(parsed.data.token, parsed.data.newPassword);

  return new ApiResponse(200, null, "Password reset successfully").send(res);
}

export const forgotPasswordController = asyncHandler(forgotPassword);
export const verifyResetCodeController = asyncHandler(verifyResetCode);
export const resetPasswordController = asyncHandler(resetPassword);


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

    return res.status(200).json({ accessToken: newAccessToken });
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
