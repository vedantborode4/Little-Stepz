import { router } from "expo-router";
import { useAuthStore } from "../store/auth.store";
import { useCartStore } from "../store/cart.store";
import { useWishlistStore } from "../store/wishlist.store";
import { CartService } from "../lib/services/cart.service";
import { AuthService } from "../lib/services/auth.service";
import {
  setToken,
  setRefreshToken,
  setUser,
  removeToken,
  removeUser,
  getCartSessionSync,
  removeCartSession,
} from "../lib/api/token";
import { unregisterPushNotifications } from "../lib/push";
import type { AuthResponse } from "../types/auth";

export function useAuth() {
  const { user, setAuth, logout, isAuthenticated } = useAuthStore();

  const login = async (data: AuthResponse) => {
    await setToken(data.accessToken);
    if (data.refreshToken) await setRefreshToken(data.refreshToken);
    await setUser(data.user);
    setAuth(data);

    // Merge the guest cart into the authenticated user's cart. The session id is
    // the one the API echoed back while shopping as a guest (persisted in
    // SecureStore), so this works even if the cookie jar was wiped.
    try {
      const cartSession = getCartSessionSync();
      if (cartSession) {
        await CartService.sync(cartSession);
        await removeCartSession();
      }
    } catch {
      // Non-fatal: the backend also auto-merges on the first authenticated GET /cart.
    }

    // Pull the signed-in user's own cart and wishlist so no state from the guest
    // session (or a previously signed-in account) is left on screen.
    await Promise.all([
      useCartStore.getState().fetchCart(),
      useWishlistStore.getState().fetchWishlist(),
    ]).catch(() => {});
  };

  const signOut = async () => {
    // Unregister this device's push token while the access token is still valid.
    await unregisterPushNotifications();
    await AuthService.logout();
    await removeToken();
    await removeUser();
    await removeCartSession();
    logout();
    router.replace("/(auth)/signin");
  };

  return { user, login, signOut, isAuthenticated };
}
