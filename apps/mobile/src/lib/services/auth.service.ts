import { api } from "../api/client";
import { getRefreshTokenSync } from "../api/token";
import type { AuthResponse } from "../../types/auth";
import type {
  ForgotPasswordData,
  ResetPasswordData,
  SigninData,
  SignupData,
  VerifyResetCodeData,
} from "@repo/zod-schema/index";

// Auth responses are top-level (res.data), not wrapped in { data }.
export const AuthService = {
  signIn: async (data: SigninData): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>("/auth/signin", data);
    return res.data;
  },

  signUp: async (data: SignupData): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>("/auth/signup", data);
    return res.data;
  },

  googleAuth: async (idToken: string, referralCode?: string): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>("/auth/google", { idToken, referralCode });
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
