import { router } from "expo-router";
import { useAuthStore } from "../store/auth.store";
import { useCartStore } from "../store/cart.store";
import { CartService } from "../lib/services/cart.service";
import { AuthService } from "../lib/services/auth.service";
import { setToken, setUser, removeToken, removeUser } from "../lib/api/token";
import { getGuestSessionId, clearGuestSessionId } from "../lib/utils/guest-session";
import { unregisterPushNotifications } from "../lib/push";
import type { AuthResponse } from "../types/auth";

export function useAuth() {
  const { user, setAuth, logout, isAuthenticated } = useAuthStore();

  const login = async (data: AuthResponse) => {
    await setToken(data.accessToken);
    await setUser(data.user);
    setAuth(data);

    // Merge guest cart into the authenticated user's cart (mirror web).
    try {
      const guestSessionId = await getGuestSessionId();
      if (guestSessionId) {
        await CartService.sync(guestSessionId);
        await clearGuestSessionId();
      }
      await useCartStore.getState().fetchCart();
    } catch {
      // non-fatal
    }
  };

  const signOut = async () => {
    // Unregister this device's push token while the access token is still valid.
    await unregisterPushNotifications();
    await AuthService.logout();
    await removeToken();
    await removeUser();
    logout();
    router.replace("/(auth)/signin");
  };

  return { user, login, signOut, isAuthenticated };
}
