import { api } from "../api/client";

export const UserService = {
  getMe: async () => {
    const res = await api.get("/users/me");
    return res.data.data;
  },
  updateMe: async (data: { name?: string; phone?: string }) => {
    const res = await api.put("/users/me", data);
    return res.data.data;
  },
  /**
   * Permanently closes the account. The server refuses (409) while an order,
   * pre-order or affiliate payout is still in flight, and surfaces why.
   */
  deleteAccount: async () => {
    await api.delete("/users/me");
  },
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    // Backend expects `oldPassword` (see updatePasswordSchema), not `currentPassword`.
    const res = await api.put("/users/me/password", {
      oldPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
    return res.data.data;
  },
};
