import type { ChangePasswordInput, LoginInput, SessionDto, SessionUserDto } from "@repo/crm-schema"
import { api, sendData } from "@/lib/api-client"
import { useAuthStore } from "@/store/auth.store"

export async function signIn(input: LoginInput) {
  const session = await sendData<SessionDto>("post", "/auth/login", input)
  useAuthStore.getState().setSession(session)
  return session.user
}

export async function changePassword(input: ChangePasswordInput) {
  const { user } = await sendData<{ user: SessionUserDto }>("post", "/auth/change-password", input)
  useAuthStore.getState().setUser(user)
  return user
}

export async function signOut() {
  try {
    await api.post("/auth/logout")
  } finally {
    useAuthStore.getState().clear()
    window.location.href = "/login"
  }
}
