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

  /**
   * Permanently closes the account. The server refuses (409) while an order,
   * pre-order or affiliate payout is still in flight, and says which.
   */
  deleteAccount: async () => {
    await api.delete("/users/me")
  },

  changePassword: async (data: any) => {
    const res = await api.put("/users/me/password", data)
    return res.data.data
  },
}
