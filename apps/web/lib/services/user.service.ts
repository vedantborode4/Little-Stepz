import { api } from "../api-client"
import { AuthResponse } from "../../types/auth"

export const UserService = {
  getMe: async () => {
    const res = await api.get<AuthResponse["user"]>("/users/me")
    return res.data
  },
}
