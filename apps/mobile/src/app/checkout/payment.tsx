import { useRef } from "react";
import { ActivityIndicator, BackHandler, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { useCallback } from "react";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { useAuthStore } from "../../store/auth.store";
import { toast } from "../../store/toast.store";
import { RAZORPAY_CHECKOUT_JS, RAZORPAY_ORIGIN } from "../../lib/env";
import { scriptJson } from "../../lib/utils/scriptJson";
import { colors } from "../../theme/tokens";

export default function Payment() {
  const params = useLocalSearchParams<{
    orderId: string;
    razorpayOrderId: string;
    amount: string;
    currency: string;
    keyId: string;
  }>();
  const user = useAuthStore((s) => s.user);
  const handled = useRef(false);

  // Android hardware back = treat as cancel
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!handled.current) {
          toast.info("Payment cancelled");
        }
        return false;
      });
      return () => sub.remove();
    }, [])
  );

  const amountPaise = Number(params.amount) * 100;

  // Every dynamic value crosses into the WebView as ONE JSON blob — nothing dynamic
  // is written as raw JS source, so a missing JSON.stringify can't leak an RN
  // identifier into WebView scope (which throws a silent, screen-blanking
  // ReferenceError). Only function literals below are written as source.
  const options = {
    key: params.keyId,
    amount: amountPaise,
    currency: params.currency || "INR",
    order_id: params.razorpayOrderId,
    name: "Little Stepz",
    description: "Order Payment",
    prefill: { name: user?.name ?? "", email: user?.email ?? "" },
    theme: { color: colors.primary },
  };

  const html = `<!DOCTYPE html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
  <body style="background:#FFF7F7;margin:0">
    <script src="${RAZORPAY_CHECKOUT_JS}"></script>
    <script>
      function post(payload){ window.ReactNativeWebView.postMessage(JSON.stringify(payload)); }
      // Catches async throws from inside Razorpay's modal that try/catch can't see.
      window.onerror = function (m) { post({ type: "error", message: String(m) }); };
      try {
        var options = ${scriptJson(options)};
        options.handler = function (response) { post({ type: "success", response: response }); };
        options.modal = { ondismiss: function () { post({ type: "dismiss" }); } };
        var rzp = new Razorpay(options);
        rzp.on("payment.failed", function (resp) { post({ type: "failed", error: resp.error }); });
        rzp.open();
      } catch (e) { post({ type: "error", message: String((e && e.message) || e) }); }
    </script>
  </body>
</html>`;

  const onMessage = async (e: WebViewMessageEvent) => {
    let msg: any;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }

    if (msg.type === "success") {
      handled.current = true;
      // Hand off to the verify/poll screen which confirms the signature and
      // polls order status (loading → success / pending / failed).
      router.replace({
        pathname: "/checkout/verifying",
        params: {
          orderId: params.orderId,
          razorpayOrderId: msg.response.razorpay_order_id,
          razorpayPaymentId: msg.response.razorpay_payment_id,
          razorpaySignature: msg.response.razorpay_signature,
        },
      });
    } else if (msg.type === "failed") {
      handled.current = true;
      toast.error(msg.error?.description || "Payment failed");
      router.replace({ pathname: "/checkout/success", params: { orderId: params.orderId, state: "failed" } });
    } else if (msg.type === "dismiss") {
      handled.current = true;
      toast.info("Payment cancelled");
      router.back();
    } else if (msg.type === "error") {
      handled.current = true;
      toast.error("Could not start payment");
      router.back();
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <Header title="Payment" />
      <View className="flex-1">
        <WebView
          originWhitelist={["*"]}
          source={{ html, baseUrl: RAZORPAY_ORIGIN }}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
          setSupportMultipleWindows={false}
          startInLoadingState
          renderLoading={() => (
            <View className="absolute inset-0 items-center justify-center bg-bg">
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        />
      </View>
    </ScreenContainer>
  );
}
