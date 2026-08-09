import { View, Text } from "react-native";

import { AppleAuthButton } from "./AppleAuthButton";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { useAppleAuthAvailable } from "../../hooks/useAppleAuth";
import { isGoogleConfigured } from "../../hooks/useGoogleAuth";

/**
 * The third-party sign-in block. Owns the "or" divider so it appears exactly
 * once regardless of which providers are available on this platform, and
 * renders nothing at all when none are.
 */
export function SocialAuth({ redirectTo }: { redirectTo?: string }) {
  const appleAvailable = useAppleAuthAvailable();
  const googleAvailable = isGoogleConfigured();

  if (!appleAvailable && !googleAvailable) return null;

  return (
    <View className="mt-6">
      <View className="mb-4 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs text-muted">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <View className="gap-3">
        {appleAvailable ? <AppleAuthButton redirectTo={redirectTo} /> : null}
        {googleAvailable ? <GoogleAuthButton redirectTo={redirectTo} /> : null}
      </View>
    </View>
  );
}
