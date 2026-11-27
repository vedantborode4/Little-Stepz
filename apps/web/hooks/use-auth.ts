import { useAuthStore } from "../store/auth.store"
import { useCartStore } from "../store/useCartStore"
import { CartService } from "../lib/services/cart.service"
import { useGuestSessionStore } from "../store/useGuestSessionStore"
import {
  setAccessToken,
  removeAccessToken,
} from "../lib/utils/token"

// Key used to persist a guest session ID in localStorage
const GUEST_SESSION_KEY = "guestSessionId"

export const useAuth = () => {
  const { user, setAuth, logout, isAuthenticated } = useAuthStore()

  const login = async (data: any) => {
    setAccessToken(data.accessToken)
    setAuth(data)
    // A real sign-in replaces any guest checkout session in this tab.
    useGuestSessionStore.getState().clear()

    // Merge any guest cart items into the newly authenticated user's cart
    try {
      const guestSessionId = localStorage.getItem(GUEST_SESSION_KEY)
      if (guestSessionId) {
        await CartService.sync(guestSessionId)
        localStorage.removeItem(GUEST_SESSION_KEY)
      }
      // Refresh cart to reflect merged items
      await useCartStore.getState().fetchCart()
    } catch {
      // Non-fatal: cart sync failure should not block login
    }
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