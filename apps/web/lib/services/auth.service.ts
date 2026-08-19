import {
  ForgotPasswordData,
  ResetPasswordData,
  SigninData,
  SignupData,
  VerifyResetCodeData,
  VerifySignupOtpData,
} from "@repo/zod-schema/index"
import { api } from "../api-client"
import { AuthResponse } from "../../types/auth"

export const AuthService = {
  signIn: async (data: SigninData) => {
    const res = await api.post<AuthResponse>("/auth/signin", data)
    return res.data
  },

  /**
   * Step 1 of signup — emails a verification code. No account exists until
   * `verifySignupOtp` succeeds, so nothing here signs the user in.
   */
  requestSignupOtp: async (data: SignupData) => {
    const res = await api.post<{
      message: string
      expiresInMinutes: number
      resendAfterSeconds: number
    }>("/auth/signup/request", data)
    return res.data
  },

  /** Step 2 — redeem the code; this is what actually creates the account. */
  verifySignupOtp: async (data: VerifySignupOtpData) => {
    const res = await api.post<AuthResponse>("/auth/signup/verify", data)
    return res.data
  },

  googleAuth: async (idToken: string, referralCode?: string) => {
    const res = await api.post<AuthResponse>("/auth/google", { idToken, referralCode })
    return res.data
  },

  forgotPassword: async (data: ForgotPasswordData) => {
    const res = await api.post("/auth/forgot-password", data)
    return res.data
  },

  verifyResetCode: async (data: VerifyResetCodeData) => {
    const res = await api.post<{ data: { token: string } }>("/auth/verify-reset-code", data)
    return res.data.data
  },

  resetPassword: async (data: ResetPasswordData) => {
    const res = await api.post("/auth/reset-password", data)
    return res.data
  },
}
