import { SigninData, SignupData } from "@repo/zod-schema/index"
import { api } from "../api-client"
import { AuthResponse } from "../../types/auth"

export const AuthService = {
  signIn: async (data: SigninData) => {
    const res = await api.post<AuthResponse>("/auth/signin", data)
    return res.data
  },

  signUp: async (data: SignupData) => {
    const res = await api.post<AuthResponse>("/auth/signup", data)
    return res.data
  },
}
