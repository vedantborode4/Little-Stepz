import { Request, Response } from "express";
import {
  AppleAuthSchema,
  forgotPasswordSchema,
  GoogleAuthSchema,
  resetPasswordSchema,
  SigninSchema,
  SignupSchema,
  verifyResetCodeSchema,
  verifySignupOtpSchema,
} from "@repo/zod-schema/index";
import {
  appleAuthService,
  googleAuthService,
  logoutService,
  refreshService,
  requestPasswordResetService,
  requestSignupOtpService,
  resetPasswordService,
  signinService,
  verifyResetCodeService,
  verifySignupOtpService,
} from "../services/auth.services";
import { ApiError, ApiResponse, asyncHandler } from "../utils/api";
import {
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "../utils/constants";
import { isNativeClient } from "../utils/client";

/**
 * Native clients get the refresh token in the response body as well, because they
 * cannot depend on the cookie jar surviving a cold start (see utils/client.ts).
 * Browsers are unaffected — they never receive it outside the httpOnly cookie.
 */
function authPayload(
  req: Request,
  user: unknown,
  accessToken: string,
  refreshToken: string
) {
  return isNativeClient(req)
    ? { user, accessToken, refreshToken }
    : { user, accessToken };
}


/**
 * Step 1 — validate the signup and email a code. No account exists yet.
 *
 * Uses asyncHandler + ApiError like the password-reset controllers rather than the
 * try/catch-to-500 style the old signup used, so business errors keep their real
 * status (409 for a taken email, 429 for a resend cooldown) instead of all becoming
 * "Internal Server Error".
 */
async function requestSignupOtp(req: Request, res: Response) {
  const parsed = SignupSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid request data", parsed.error.flatten().fieldErrors);
  }

  const meta = await requestSignupOtpService(parsed.data, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  });

  // Top-level, matching signin/signup — `authPayload` and both clients' `login(res)`
  // read res.data, not res.data.data.
  return res.status(200).json({ message: "Verification code sent", ...meta });
}

/** Step 2 — redeem the code, create the account, sign the user in. */
async function verifySignupOtp(req: Request, res: Response) {
  const parsed = verifySignupOtpSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid request data", parsed.error.flatten().fieldErrors);
  }

  const { user, accessToken, refreshToken } =
    await verifySignupOtpService(parsed.data.email, parsed.data.code);

  res.cookie("accessToken", accessToken, accessTokenCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

  return res.status(201).json(authPayload(req, user, accessToken, refreshToken));
}

/**
 * The old direct-signup route. Shipped mobile builds still call it, so it must not
 * 404. 426 is semantically right and — importantly — is NOT 401, which would trip
 * both clients' refresh interceptor and bounce the user to sign-in.
 */
async function legacySignup(_req: Request, _res: Response) {
  throw new ApiError(426, "APP_UPDATE_REQUIRED");
}

export const requestSignupOtpController = asyncHandler(requestSignupOtp);
export const verifySignupOtpController = asyncHandler(verifySignupOtp);
export const signupController = asyncHandler(legacySignup);

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

    return res.status(200).json(authPayload(req, user, accessToken, refreshToken));
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

    return res.status(200).json(authPayload(req, user, accessToken, refreshToken));
  } catch (err) {
    if (err instanceof Error) {
      return res.status(401).json({ message: err.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function appleController(req: Request, res: Response) {
  try {
    const parsed = AppleAuthSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid request data",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { identityToken, givenName, familyName, referralCode } = parsed.data;

    const { user, accessToken, refreshToken } = await appleAuthService(
      identityToken,
      { givenName, familyName, referralCode }
    );

    res.cookie("accessToken", accessToken, accessTokenCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

    return res.status(200).json(authPayload(req, user, accessToken, refreshToken));
  } catch (err) {
    if (err instanceof Error) {
      return res.status(401).json({ message: err.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function logoutController(req: Request, res: Response) {
  try {
    const refreshToken: string | undefined =
      req.cookies?.refreshToken || req.body?.refreshToken;

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
    // Cookie first (web); fall back to the body so a native client whose cookie jar
    // was wiped can still refresh from its own SecureStore copy.
    const refreshToken: string | undefined =
      req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token required" });
    }

    const {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    } = await refreshService(refreshToken);

    res.cookie("accessToken", newAccessToken, accessTokenCookieOptions);
    res.cookie("refreshToken", newRefreshToken, refreshTokenCookieOptions);

    // Rotation means the old token is now dead — a native client MUST receive the
    // replacement or it can never refresh again.
    return res.status(200).json(
      isNativeClient(req)
        ? { accessToken: newAccessToken, refreshToken: newRefreshToken }
        : { accessToken: newAccessToken }
    );
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
