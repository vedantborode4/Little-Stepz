import { View, useColorScheme } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

import { useAppleAuth } from "../../hooks/useAppleAuth";

/**
 * Apple's Human Interface Guidelines require their own button component — a
 * custom-drawn lookalike is a review rejection. Sized to match `Button` (md).
 */
export function AppleAuthButton({ redirectTo }: { redirectTo?: string }) {
  const { signInWithApple, loading } = useAppleAuth(redirectTo);
  const scheme = useColorScheme();

  return (
    <View pointerEvents={loading ? "none" : "auto"} style={{ opacity: loading ? 0.6 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={
          scheme === "dark"
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={6}
        style={{ width: "100%", height: 48 }}
        onPress={signInWithApple}
      />
    </View>
  );
}
