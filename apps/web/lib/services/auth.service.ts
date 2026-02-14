import { AuthResponse, SignInDto, SignUpDto } from "../../types/auth"
import { api } from "../api-client"

export const AuthService = {
  signIn: async (data: SignInDto) => {
    const res = await api.post<AuthResponse>("/auth/signin", data)
    return res.data
  },

  signUp: async (data: SignUpDto) => {
    const res = await api.post<AuthResponse>("/auth/signup", data)
    return res.data
  },
}
