import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";

import { useAuthStore } from "../store/auth.store";
import { useThemeColors } from "../theme/useThemeColors";

/**
 * Landing screen for the Google OAuth redirect.
 *
 * The code exchange is owned by `useGoogleOAuthCallback` at the root, which listens
 * for the deep link directly rather than depending on this route matching. This
 * screen exists so that when expo-router *does* match the callback path, the user
 * sees a spinner instead of the "Unmatched Route" 404.
 */
export default function OAuthRedirect() {
  const colors = useThemeColors();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(tabs)/home");
      return;
    }
    // Never strand the user here if the exchange fails or never arrives.
    const timeout = setTimeout(() => router.replace("/(auth)/signin"), 8000);
    return () => clearTimeout(timeout);
  }, [isAuthenticated]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundColor: colors.bg,
      }}
    >
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.muted, fontFamily: "Jakarta", fontSize: 14 }}>
        Signing you in…
      </Text>
    </View>
  );
}
