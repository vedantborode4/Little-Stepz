import { ActivityIndicator, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { ScreenContainer } from "../components/layout/ScreenContainer";
import { Header } from "../components/layout/Header";
import { TAWK_CHAT_URL } from "../lib/env";
import { colors } from "../theme/tokens";

/**
 * Live chat (tawk.to) in a WebView. Anonymous — no user data is injected, and the
 * WebView is origin-whitelisted to tawk.to. No-ops gracefully when unconfigured.
 */
export default function Support() {
  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <Header title="Chat with us" />
      {TAWK_CHAT_URL ? (
        <View className="flex-1">
          <WebView
            source={{ uri: TAWK_CHAT_URL }}
            originWhitelist={["https://*.tawk.to", "https://tawk.to"]}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View className="absolute inset-0 items-center justify-center bg-bg">
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          />
        </View>
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base text-muted">
            Live chat is not available right now. Please try again later.
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}
