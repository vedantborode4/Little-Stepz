import { api } from "../api/client";
import { getRefreshTokenSync } from "../api/token";
import type { AuthResponse } from "../../types/auth";
import type {
  AppleAuthData,
  ForgotPasswordData,
  ResetPasswordData,
  SigninData,
  SignupData,
  VerifyResetCodeData,
  VerifySignupOtpData,
} from "@repo/zod-schema/index";

// Auth responses are top-level (res.data), not wrapped in { data }.
export const AuthService = {
  signIn: async (data: SigninData): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>("/auth/signin", data);
    return res.data;
  },

  /**
   * Step 1 of signup — emails a verification code. No account exists yet, so there
   * is nothing to log in with until `verifySignupOtp` succeeds.
   */
  requestSignupOtp: async (
    data: SignupData
  ): Promise<{ message: string; expiresInMinutes: number; resendAfterSeconds: number }> => {
    const res = await api.post("/auth/signup/request", data);
    return res.data;
  },

  /** Step 2 — redeem the code; this is what creates the account. */
  verifySignupOtp: async (data: VerifySignupOtpData): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>("/auth/signup/verify", data);
    return res.data;
  },

  googleAuth: async (idToken: string, referralCode?: string): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>("/auth/google", { idToken, referralCode });
    return res.data;
  },

  appleAuth: async (data: AppleAuthData): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>("/auth/apple", data);
    return res.data;
  },

  forgotPassword: async (data: ForgotPasswordData): Promise<void> => {
    await api.post("/auth/forgot-password", data);
  },

  // password reset endpoints use the { data } envelope
  verifyResetCode: async (data: VerifyResetCodeData): Promise<{ token: string }> => {
    const res = await api.post<{ data: { token: string } }>("/auth/verify-reset-code", data);
    return res.data.data;
  },

  resetPassword: async (data: ResetPasswordData): Promise<void> => {
    await api.post("/auth/reset-password", data);
  },

  logout: async (): Promise<void> => {
    try {
      // Send our stored refresh token so the server can revoke this session even
      // when the cookie jar has already dropped it.
      await api.post("/auth/logout", { refreshToken: getRefreshTokenSync() ?? undefined });
    } catch {
      // best-effort; local state is cleared regardless
    }
  },
};
