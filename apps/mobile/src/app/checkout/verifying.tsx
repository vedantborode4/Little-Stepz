import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { CheckoutService } from "../../lib/services/checkout.service";
import { OrderService } from "../../lib/services/order.service";
import { useCheckoutStore } from "../../store/checkout.store";
import { useCartStore } from "../../store/cart.store";
import { formatPrice, shortId } from "../../lib/utils/format";
import type { Order } from "../../types/order";
import { colors } from "../../theme/tokens";

type State = "loading" | "success" | "pending" | "failed";

const MAX_POLLS = 8;
const POLL_INTERVAL = 3000;

function classify(order: Order): State {
  const ps = order?.payment?.status?.toUpperCase();
  const os = order?.status?.toUpperCase();
  if (ps === "SUCCESS" || os === "CONFIRMED" || os === "PROCESSING") return "success";
  if (ps === "FAILED" || os === "CANCELLED") return "failed";
  return "pending";
}

export default function Verifying() {
  const params = useLocalSearchParams<{
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }>();

  const resetSession = useCheckoutStore((s) => s.resetSession);
  const fetchCart = useCartStore((s) => s.fetchCart);

  const [state, setState] = useState<State>("loading");
  const [order, setOrder] = useState<Order | null>(null);
  const [attempts, setAttempts] = useState(0);
  const verifiedRef = useRef(false);
  const settledRef = useRef(false);

  const check = useCallback(async (): Promise<boolean> => {
    try {
      // Verify the Razorpay signature once; if it fails we still poll the
      // order status in case the webhook confirms it server-side.
      if (!verifiedRef.current) {
        verifiedRef.current = true;
        try {
          await CheckoutService.verifyPayment({
            razorpayOrderId: params.razorpayOrderId,
            razorpayPaymentId: params.razorpayPaymentId,
            razorpaySignature: params.razorpaySignature,
            orderId: params.orderId,
          });
        } catch {
          /* fall through to polling */
        }
      }

      const data = await OrderService.getById(params.orderId);
      setOrder(data);
      const next = classify(data);
      setState(next);
      if (next === "success" && !settledRef.current) {
        settledRef.current = true;
        resetSession();
        fetchCart();
      }
      return next !== "pending";
    } catch {
      setState((s) => (s === "loading" ? "pending" : s));
      return false;
    }
  }, [params.orderId, params.razorpayOrderId, params.razorpayPaymentId, params.razorpaySignature, resetSession, fetchCart]);

  useEffect(() => {
    if (!params.orderId) return;
    let poll = 0;
    let interval: ReturnType<typeof setInterval>;

    const run = async () => {
      const done = await check();
      poll += 1;
      setAttempts(poll);
      if (done || poll >= MAX_POLLS) {
        clearInterval(interval);
        setState((s) => (s === "loading" ? "pending" : s));
      }
    };

    run();
    interval = setInterval(run, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [params.orderId, check]);

  const retry = () => {
    setAttempts(0);
    setState("loading");
    let poll = 0;
    let interval: ReturnType<typeof setInterval>;
    const run = async () => {
      const done = await check();
      poll += 1;
      setAttempts(poll);
      if (done || poll >= MAX_POLLS) {
        clearInterval(interval);
        setState((s) => (s === "loading" ? "pending" : s));
      }
    };
    run();
    interval = setInterval(run, POLL_INTERVAL);
  };

  if (state === "loading") {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-sm text-muted">Confirming your payment…</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (state === "success") {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-6">
          <Card className="w-full items-center gap-4 py-8">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <Ionicons name="checkmark-circle" size={40} color={colors.success} />
            </View>
            <View className="items-center">
              <Text className="text-xl font-jakarta-bold text-text">Payment Successful!</Text>
              <Text className="mt-1 text-sm text-muted">Your order has been confirmed.</Text>
            </View>
            {order ? (
              <View className="w-full gap-2 rounded-xl bg-bg p-4">
                <Row label="Order ID" value={`#${shortId(order.id)}`} />
                <Row label="Amount Paid" value={formatPrice(order.total)} />
                <Row label="Payment" value={order.paymentMethod === "COD" ? "Cash on Delivery" : "Online"} />
              </View>
            ) : null}
            <View className="w-full gap-2">
              <Button label="View Order Details" onPress={() => router.replace({ pathname: "/orders/[id]", params: { id: params.orderId } })} />
              <Button label="Continue Shopping" variant="outline" onPress={() => router.replace("/(tabs)/home")} />
            </View>
          </Card>
        </View>
      </ScreenContainer>
    );
  }

  if (state === "failed") {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-6">
          <Card className="w-full items-center gap-4 py-8">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-danger/10">
              <Ionicons name="close-circle" size={40} color={colors.danger} />
            </View>
            <View className="items-center">
              <Text className="text-xl font-jakarta-bold text-text">Payment Failed</Text>
              <Text className="mt-1 text-center text-sm text-muted">
                {"We couldn't process your payment. Your cart is intact — please try again."}
              </Text>
            </View>
            <View className="w-full gap-2">
              <Button label="Try Again" onPress={() => router.replace("/checkout")} />
              <Button label="View Orders" variant="outline" onPress={() => router.replace("/orders")} />
            </View>
          </Card>
        </View>
      </ScreenContainer>
    );
  }

  // pending
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center px-6">
        <Card className="w-full items-center gap-4 py-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-warning/10">
            <Ionicons name="time-outline" size={40} color={colors.warning} />
          </View>
          <View className="items-center">
            <Text className="text-xl font-jakarta-bold text-text">Payment Processing</Text>
            <Text className="mt-1 text-center text-sm text-muted">
              Your payment is being verified. This usually takes a few seconds.
            </Text>
          </View>
          {attempts >= MAX_POLLS ? (
            <View className="w-full rounded-xl border border-warning/30 bg-warning/10 p-3">
              <Text className="text-center text-xs text-warning">
                Taking longer than expected. Check your orders page for the latest status.
              </Text>
            </View>
          ) : null}
          <View className="w-full gap-2">
            <Button label="Check Again" left={<Ionicons name="refresh" size={15} color="#fff" />} onPress={retry} />
            <Button label="View My Orders" variant="outline" onPress={() => router.replace("/orders")} />
          </View>
        </Card>
      </View>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-jakarta-medium text-text">{value}</Text>
    </View>
  );
}
