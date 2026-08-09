"use client"

import { useEffect } from "react"
import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import { useWishlistStore } from "../../store/useWishlistStore"
import {
  getAccessToken,
  removeAccessToken,
} from "../../lib/utils/token"
import { UserService } from "../../lib/services/user.service"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // ✅ FIX: Empty dependency array — this effect must only run ONCE on mount.
    //
    // The original bug: dependency array had [setAuth, logout, fetchCart, fetchWishlist, setHydrated].
    // Zustand recreates these function references on every render, so the effect
    // re-fired on every render → infinite hydrate() calls → continuous reload loop on signin page.
    //
    // Fix: Read store actions from getState() (always stable references) and use
    // an empty deps array so hydration only ever happens once on mount.
    const hydrate = async () => {
      const { setAuth, logout, setHydrated, isAuthenticated } = useAuthStore.getState()
      const { fetchCart } = useCartStore.getState()
      const { fetchWishlist } = useWishlistStore.getState()

      // Signals a prior session WITHOUT depending on a readable token. The
      // backend's accessToken cookie is httpOnly, and the JS-visible copy is a
      // session cookie — so after a browser restart it is gone while the 15-day
      // refresh cookie is still perfectly valid. Keying off the cookie declared
      // those users guests and skipped every authenticated fetch. `isAuthenticated`
      // is persisted to localStorage and survives the restart, so it is the honest
      // signal. Requests then go through the api client, whose 401 interceptor
      // spends the refresh cookie and repairs the readable copy.
      const hadSession = isAuthenticated || !!getAccessToken()

      try {
        if (hadSession) {
          const user = await UserService.getMe()
          setAuth({ accessToken: getAccessToken() ?? null, user } as any)
        }

        await fetchCart()

        if (hadSession) {
          await fetchWishlist()
        }
      } catch {
        removeAccessToken()
        logout()
      } finally {
        setHydrated(true)
      }
    }

    hydrate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // ← intentionally empty: hydrate must only run once on mount

  // Children render immediately, including during server rendering.
  //
  // This previously held a `loading` state that started `true` and was only
  // cleared inside the effect above. Effects never run on the server, so the
  // provider returned `null` for every server render — the entire site body,
  // on every route, was absent from the HTML response. Navbar, footer, page
  // content and all nested JSON-LD existed only in the RSC flight payload,
  // which requires JavaScript to materialise. That is why the live site serves
  // zero <h1> elements and no structured data below the root layout.
  //
  // Gating render on auth state is not this component's job: AuthGuard,
  // GuestGuard, AdminGuard, AffiliateGuard and Navbar each already wait on
  // `isHydrated` from the auth store, so protected routes stay protected.
  return children
}
