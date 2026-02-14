import { useAuthStore } from "../store/auth.store"
import { setToken, removeToken } from "../lib/utils/token"

export const useAuth = () => {
  const { user, setAuth, logout } = useAuthStore()

  const login = (data: any) => {
    setToken(data.accessToken)
    setAuth(data)
  }

  const signOut = () => {
    removeToken()
    logout()
  }

  return { user, login, signOut }
}
