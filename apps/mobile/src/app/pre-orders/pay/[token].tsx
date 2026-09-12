import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { Header } from "../../../components/layout/Header";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PreOrderService } from "../../../lib/services/preorder.service";
import { formatPrice } from "../../../lib/utils/format";
import { getErrorMessage } from "../../../lib/utils/errors";
import { useAuthStore } from "../../../store/auth.store";
import { toast } from "../../../store/toast.store";
import { colors } from "../../../theme/tokens";

/**
 * Pay a pre-order balance from the emailed link — the app twin of the website's
 * /pre-orders/pay/[token]. Public on purpose: the token is the credential, so a shopper
 * who is not signed in on this device can still complete the order.
 *
 * After payment the payment screen returns here, and the fresh fetch shows the result.
 */
export default function PreOrderBalancePay() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [paying, setPaying] = useState(false);

  const { data: po, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["pre-orders", "pay", token],
    queryFn: () => PreOrderService.getByToken(token),
    enabled: !!token,
    retry: false,
    // Always re-read: this screen is revisited straight after a payment completes.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const pay = async () => {
    if (!po || paying) return;
    setPaying(true);
    try {
      const init = await PreOrderService.createBalancePayment(token);
      router.push({
        pathname: "/pre-order/payment",
        params: {
          razorpayOrderId: init.razorpayOrderId,
          amount: String(init.amount),
          currency: init.currency,
          keyId: init.keyId,
          mode: "balance",
          token,
        },
      });
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not start payment"));
      refetch();
    } finally {
      setPaying(false);
    }
  };

  const goHome = () => router.replace("/(tabs)/home");

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Complete your pre-order" onBack={router.canGoBack() ? undefined : goHome} />
        <View className="gap-3 p-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !po) {
    return (
      <ScreenContainer>
        <Header title="Complete your pre-order" onBack={router.canGoBack() ? undefined : goHome} />
        <EmptyState
          icon="link-outline"
          title="This link isn't valid"
          subtitle={getErrorMessage(error, "This pre-order link is invalid or has expired.")}
          actionLabel={isRefetching ? "Retrying…" : "Try again"}
          onAction={() => refetch()}
        />
      </ScreenContainer>
    );
  }

  if (po.status === "COMPLETED") {
    return (
      <ScreenContainer className="items-center justify-center px-8">
        <View className="w-full items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text className="mt-5 text-2xl font-jakarta-bold text-text">Order confirmed</Text>
          <Text className="mt-2 text-center text-muted">
            Thanks! We&apos;ve received your balance payment for {po.product.name}. Your order is now
            being processed.
          </Text>
          <View className="mt-8 w-full gap-3">
            {isAuthenticated ? (
              <Button
                label={po.orderId ? "View Order" : "My Pre-Orders"}
                onPress={() => router.replace((po.orderId ? `/orders/${po.orderId}` : "/pre-orders") as never)}
              />
            ) : (
              <Button label="Sign In to Track It" onPress={() => router.replace("/(auth)/signin")} />
            )}
            <Button label="Continue Shopping" variant="outline" onPress={goHome} />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const payable = po.status === "AWAITING_BALANCE";

  return (
    <ScreenContainer>
      <Header title="Complete your pre-order" onBack={router.canGoBack() ? undefined : goHome} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Card className="flex-row items-center gap-3">
          <View className="h-20 w-20 overflow-hidden rounded-lg border border-border bg-surface-2">
            {po.product.images?.[0]?.url ? (
              <Image source={{ uri: po.product.images[0].url }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
            ) : null}
          </View>
          <View className="flex-1">
            <Text numberOfLines={2} className="font-jakarta-semibold text-text">{po.product.name}</Text>
            {po.variant?.name ? <Text className="text-xs text-muted">{po.variant.name}</Text> : null}
            <Text className="mt-1 text-sm text-muted">Qty {po.quantity}</Text>
          </View>
        </Card>

        <Card className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted">Order total</Text>
            <Text className="text-sm text-muted">{formatPrice(po.totalAmount)}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted">Booking paid</Text>
            <Text className="text-sm text-muted">− {formatPrice(po.bookingAmount)}</Text>
          </View>
          <View className="flex-row items-center justify-between border-t border-border pt-2">
            <Text className="text-base font-jakarta-bold text-text">Balance due</Text>
            <Text className="text-base font-jakarta-bold text-text">{formatPrice(po.balanceAmount)}</Text>
          </View>
        </Card>

        {payable ? (
          <Button label={`Pay ${formatPrice(po.balanceAmount)}`} loading={paying} onPress={pay} />
        ) : (
          <Card elevated={false} className="flex-row items-start gap-2">
            <Ionicons
              name={po.status === "BOOKED" ? "notifications-outline" : "alert-circle-outline"}
              size={16}
              color={po.status === "BOOKED" ? colors.primary : colors.warning}
            />
            <Text className="flex-1 text-sm text-muted">
              {po.status === "EXPIRED"
                ? "This payment link has expired. Please contact support."
                : po.status === "BOOKED"
                  ? "This isn't back in stock yet. We'll notify you when the balance is due."
                  : "This pre-order can no longer be paid for."}
            </Text>
          </Card>
        )}

        {po.status === "EXPIRED" ? (
          <Button label="Contact Support" variant="outline" onPress={() => router.push("/support" as never)} />
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
