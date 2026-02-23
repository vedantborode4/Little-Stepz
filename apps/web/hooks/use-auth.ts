import { useAuthStore } from "../store/auth.store"
import {
  setAccessToken,
  removeAccessToken,
} from "../lib/utils/token"

export const useAuth = () => {
  const { user, setAuth, logout, isAuthenticated } = useAuthStore()

  const login = (data: any) => {
    setAccessToken(data.accessToken)
    setAuth(data)
  }

  const signOut = () => {
    removeAccessToken()
    logout()
    window.location.href = "/signin"
  }

  return {
    user,
    login,
    signOut,
    isAuthenticated,
  }
}