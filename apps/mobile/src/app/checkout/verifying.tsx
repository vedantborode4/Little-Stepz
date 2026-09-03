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
import { balanceAtDoorText } from "@repo/content/index";

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
    purpose?: string;
    balanceDue?: string;
  }>();

  // The order payload is authoritative once it loads; the params are what we know
  // immediately, so the confirmation is correct even before the poll returns.
  const isDeposit = params.purpose === "deposit";

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

  // One owner for the poll timer. The previous code declared `interval` and then
  // called `run()` before assigning it, so a first-attempt success still scheduled
  // an interval; and `retry()` started a *second* loop that was never cleared on
  // unmount, leaving a timer running and calling setState on a dead component.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  const stopPolling = useCallback(() => {
    stoppedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    stoppedRef.current = false;
    let poll = 0;

    // setTimeout chaining rather than setInterval: a slow request can't stack up
    // overlapping polls the way a fixed interval can.
    const tick = async () => {
      if (stoppedRef.current) return;
      const done = await check();
      if (stoppedRef.current) return;

      poll += 1;
      setAttempts(poll);

      if (done || poll >= MAX_POLLS) {
        stopPolling();
        setState((s) => (s === "loading" ? "pending" : s));
        return;
      }
      timerRef.current = setTimeout(tick, POLL_INTERVAL);
    };

    void tick();
  }, [check, stopPolling]);

  useEffect(() => {
    if (!params.orderId) return;
    startPolling();
    return stopPolling;
  }, [params.orderId, startPolling, stopPolling]);

  const retry = () => {
    setAttempts(0);
    setState("loading");
    startPolling();
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
              <Text className="text-xl font-jakarta-bold text-text">
                {isDeposit ? "Deposit Received!" : "Payment Successful!"}
              </Text>
              <Text className="mt-1 text-sm text-muted">Your order has been confirmed.</Text>
            </View>
            {order ? (
              <View className="w-full gap-2 rounded-xl bg-bg p-4">
                <Row label="Order ID" value={`#${shortId(order.id)}`} />
                {/* Never report the order total as "paid" on a deposit — the customer
                    paid a fifth of it and still owes the rest at the door. */}
                {isDeposit ? (
                  <>
                    <Row label="Order Total" value={formatPrice(order.total)} />
                    <Row
                      label="Deposit Paid"
                      value={formatPrice(order.partial?.depositAmount ?? 0)}
                    />
                    <Row
                      label="Due at delivery"
                      value={formatPrice(order.partial?.balanceAmount ?? Number(params.balanceDue ?? 0))}
                    />
                  </>
                ) : (
                  <>
                    <Row label="Amount Paid" value={formatPrice(order.total)} />
                    <Row label="Payment" value={order.paymentMethod === "COD" ? "Cash on Delivery" : "Online"} />
                  </>
                )}
              </View>
            ) : null}
            {isDeposit ? (
              <Text className="text-center text-xs text-muted">
                {balanceAtDoorText(
                  order?.partial?.balanceAmount ?? Number(params.balanceDue ?? 0)
                )}
              </Text>
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
