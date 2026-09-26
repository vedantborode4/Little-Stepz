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
import {
  completeBootTrace,
  guard,
  guardAsync,
  mark,
  previousCrashTrace,
} from "../lib/boot-trace";
import { BootTraceScreen } from "../components/BootTraceScreen";

mark("layout:module-scope");

// Everything here runs at import time — above ErrorBoundary, above any React
// tree — so an unguarded throw aborts the process with no diagnostic at all.
guardAsync("splash:preventAutoHide", () => SplashScreen.preventAutoHideAsync());
guard("notifications:configureHandler", () => configureNotificationHandler());
// Create the Android channel at launch, not only inside the authenticated
// registration path: a push that arrives for a channel the app has never declared
// falls back to Android's default importance and shows no heads-up banner.
guardAsync("notifications:ensureAndroidChannel", () => ensureAndroidChannel());

/** Runs push wiring inside the QueryClientProvider (needs useQueryClient). */
function PushBridge() {
  mark("bridge:push");
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

  // Non-null only when the previous launch never reached `boot:complete`.
  const [crashTrace, setCrashTrace] = useState<string | null>(() => previousCrashTrace());

  const themeColors = useThemeColors();
  const isDark = useIsDark();

  // Apply the persisted theme preference to NativeWind on boot.
  useEffect(() => {
    guard("theme:apply", () => useThemeStore.getState().apply());
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
      mark("session:loadSession");
      const { token, user } = await loadSession();
      mark(`session:loaded token=${token ? "yes" : "no"} user=${user ? "yes" : "no"}`);
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
      guardAsync("cart:fetchCart", () => useCartStore.getState().fetchCart());
      if (token && user) {
        guardAsync("wishlist:fetchWishlist", () =>
          useWishlistStore.getState().fetchWishlist()
        );
      }
    })();
  }, [setHydrated]);

  const ready = authReady && fontsLoaded && isHydrated;

  useEffect(() => {
    mark(
      `layout:gate authReady=${authReady} fontsLoaded=${fontsLoaded} isHydrated=${isHydrated}`
    );
  }, [authReady, fontsLoaded, isHydrated]);

  useEffect(() => {
    if (!ready) return;
    guardAsync("splash:hide", () => SplashScreen.hideAsync());
    // Startup finished, so the next launch has nothing to report.
    completeBootTrace();
  }, [ready]);

  useEffect(() => {
    if (crashTrace) guardAsync("splash:hide-for-trace", () => SplashScreen.hideAsync());
  }, [crashTrace]);

  // The previous launch died mid-startup: show how far it got before rendering
  // the app, since that trace is the only record of where it failed.
  if (crashTrace) {
    return <BootTraceScreen trace={crashTrace} onContinue={() => setCrashTrace(null)} />;
  }

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
