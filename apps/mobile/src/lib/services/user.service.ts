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
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    // Backend expects `oldPassword` (see updatePasswordSchema), not `currentPassword`.
    const res = await api.put("/users/me/password", {
      oldPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
    return res.data.data;
  },
};
