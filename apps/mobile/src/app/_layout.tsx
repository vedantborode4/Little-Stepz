import "../global.css";

import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import { Anton_400Regular } from "@expo-google-fonts/anton";
import { Sora_600SemiBold } from "@expo-google-fonts/sora";

import { queryClient } from "../lib/api/query-client";
import { loadToken, loadUser, setUser } from "../lib/api/token";
import { useAuthStore } from "../store/auth.store";
import { UserService } from "../lib/services/user.service";
import { ToastHost } from "../components/ui/ToastHost";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AnimatedSplash } from "../components/AnimatedSplash";
import { useThemeStore } from "../store/theme.store";
import { useIsDark, useThemeColors } from "../theme/useThemeColors";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { configureNotificationHandler } from "../lib/push";

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();

/** Runs push wiring inside the QueryClientProvider (needs useQueryClient). */
function PushBridge() {
  usePushNotifications();
  return null;
}

export default function RootLayout() {
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [authReady, setAuthReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

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
      const token = await loadToken();
      const user = await loadUser();
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
        <QueryClientProvider client={queryClient}>
          <StatusBar style={isDark ? "light" : "dark"} />
          <PushBridge />
          <ErrorBoundary>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: themeColors.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="product/[slug]" options={{ headerShown: false, presentation: "card" }} />
              <Stack.Screen name="category/[slug]" />
              <Stack.Screen name="notifications" options={{ presentation: "card" }} />
            </Stack>
          </ErrorBoundary>
          <ToastHost />
        </QueryClientProvider>
      </SafeAreaProvider>
      {!splashDone ? <AnimatedSplash onDone={() => setSplashDone(true)} /> : null}
    </GestureHandlerRootView>
  );
}
