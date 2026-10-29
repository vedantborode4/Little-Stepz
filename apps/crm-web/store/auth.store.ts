import { create } from "zustand"
import type { Permission, SessionDto, SessionUserDto } from "@repo/crm-schema"

type AuthStatus = "unknown" | "authenticated" | "anonymous"

interface AuthState {
  status: AuthStatus
  user: SessionUserDto | null
  /** Kept in memory only — never in storage — so an injected script cannot lift it. */
  accessToken: string | null
  setSession: (session: SessionDto) => void
  setUser: (user: SessionUserDto) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "unknown",
  user: null,
  accessToken: null,
  setSession: ({ user, accessToken }) => set({ status: "authenticated", user, accessToken }),
  setUser: (user) => set({ user }),
  clear: () => set({ status: "anonymous", user: null, accessToken: null }),
}))

/** UI-side permission check. The API enforces the same matrix; this only hides what a role can't use. */
export function useCan() {
  const permissions = useAuthStore((s) => s.user?.permissions)
  return (permission: Permission) => permissions?.includes(permission) ?? false
}
