import { api } from "../api-client"

export const UserService = {
  getMe: async () => {
    const res = await api.get("/users/me")
    return res.data.data
  },

  updateMe: async (data: any) => {
    const res = await api.put("/users/me", data)
    return res.data.data
  },

  changePassword: async (data: any) => {
    const res = await api.put("/users/me/password", data)
    return res.data.data
  },
}
