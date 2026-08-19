import "../global.css";

import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import { Anton_400Regular } from "@expo-google-fonts/anton";
import { Sora_600SemiBold } from "@expo-google-fonts/sora";

import { queryClient, persistOptions } from "../lib/api/query-client";
import { useCartStore } from "../store/cart.store";
import { useWishlistStore } from "../store/wishlist.store";
import { loadSession, setUser } from "../lib/api/token";
import { useAuthStore } from "../store/auth.store";
import { UserService } from "../lib/services/user.service";
import { ToastHost } from "../components/ui/ToastHost";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useThemeStore } from "../store/theme.store";
import { useIsDark, useThemeColors } from "../theme/useThemeColors";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useGoogleOAuthCallback } from "../hooks/useGoogleOAuthCallback";
import { configureNotificationHandler, ensureAndroidChannel } from "../lib/push";

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();
// Create the Android channel at launch, not only inside the authenticated
// registration path: a push that arrives for a channel the app has never declared
// falls back to Android's default importance and shows no heads-up banner.
void ensureAndroidChannel();

/** Runs push wiring inside the QueryClientProvider (needs useQueryClient). */
function PushBridge() {
  usePushNotifications();
  return null;
}

/**
 * Completes a Google sign-in whose redirect arrived as a deep link — including
 * when Android killed the app while the user was on Google's page.
 */
function AuthLinkBridge() {
  useGoogleOAuthCallback();
  return null;
}

export default function RootLayout() {
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [authReady, setAuthReady] = useState(false);

  const themeColors = useThemeColors();
  const isDark = useIsDark();

  // Apply the persisted theme preference to NativeWind on boot.
  useEffect(() => {
    useThemeStore.getState().apply();
  }, []);

  // Type system (matches the intended web spec):
  //  body / sub-heading → Manrope   ·   hero heading → Anton   ·   buttons → Sora SemiBold
  // Manrope is loaded under the existing `Jakarta*` keys so every `font-jakarta*`
  // class stays Manrope; Anton + Sora get their own keys.
  const [fontsLoaded] = useFonts({
    Jakarta: Manrope_400Regular,
    "Jakarta-Medium": Manrope_500Medium,
    "Jakarta-SemiBold": Manrope_600SemiBold,
    "Jakarta-Bold": Manrope_700Bold,
    Anton: Anton_400Regular,
    "Sora-SemiBold": Sora_600SemiBold,
  });

  useEffect(() => {
    (async () => {
      // One pass hydrates the access token, refresh token, guest cart session
      // and the persisted user — everything the API client needs synchronously.
      const { token, user } = await loadSession();
      if (token && user) {
        useAuthStore.setState({ user, isAuthenticated: true });
        // Refresh the profile so role changes (e.g. promoted to ADMIN) are picked
        // up instead of trusting the possibly-stale persisted copy. Non-blocking.
        UserService.getMe()
          .then((fresh) => {
            if (fresh?.id) {
              useAuthStore.getState().setUserOnly(fresh);
              setUser(fresh);
            }
          })
          .catch(() => {});
      }
      setHydrated(true);
      setAuthReady(true);

      // Warm the cart (and the signed-in user's wishlist) in the background.
      // Without this the tab-bar badge showed 0 on every launch until the user
      // happened to open the Cart tab, and product cards rendered unfilled hearts.
      // Guests have a cart too — it's keyed by the stored cart session.
      void useCartStore.getState().fetchCart();
      if (token && user) void useWishlistStore.getState().fetchWishlist();
    })();
  }, [setHydrated]);

  const ready = authReady && fontsLoaded && isHydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <StatusBar style={isDark ? "light" : "dark"} />
          <PushBridge />
          <AuthLinkBridge />
          <ErrorBoundary>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: themeColors.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="product/[slug]" options={{ headerShown: false, presentation: "card" }} />
              {/* category/[slug] now lives inside (tabs) so it keeps the bottom menu. */}
              <Stack.Screen name="notifications" options={{ presentation: "card" }} />
            </Stack>
          </ErrorBoundary>
          <ToastHost />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
