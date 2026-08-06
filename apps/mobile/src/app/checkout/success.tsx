import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Button } from "../../components/ui/Button";
import { useCartStore } from "../../store/cart.store";
import { OrderService } from "../../lib/services/order.service";
import { qk } from "../../lib/api/query-client";
import { formatPrice } from "../../lib/utils/format";
import { colors } from "../../theme/tokens";

export default function CheckoutSuccess() {
  const { orderId, state } = useLocalSearchParams<{ orderId: string; state?: string }>();
  const failed = state === "failed";
  const fetchCart = useCartStore((s) => s.fetchCart);

  const { data: order, isLoading } = useQuery({
    queryKey: qk.order(orderId),
    queryFn: () => OrderService.getById(orderId),
    enabled: !!orderId && !failed,
  });

  useEffect(() => {
    if (!failed) fetchCart();
  }, [failed, fetchCart]);

  if (failed) {
    return (
      <ScreenContainer className="items-center justify-center px-8">
        <View className="items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-danger/10">
            <Ionicons name="close-circle" size={56} color={colors.danger} />
          </View>
          <Text className="mt-5 text-2xl font-jakarta-bold text-text">Payment Failed</Text>
          <Text className="mt-2 text-center text-muted">
            Your payment could not be completed. Your cart is still saved — you can try again.
          </Text>
          <View className="mt-8 w-full gap-3">
            <Button label="Try Again" onPress={() => router.replace("/checkout")} />
            <Button label="Continue Shopping" variant="outline" onPress={() => router.replace("/(tabs)/home")} />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const items = order?.items ?? [];
  const addr = order?.address ?? null;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <View className="items-center gap-3 rounded-2xl border border-border bg-surface p-8">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <Ionicons name="checkmark-circle" size={44} color={colors.success} />
          </View>
          <View className="items-center">
            <Text className="text-2xl font-jakarta-bold text-text">Order Placed! 🎉</Text>
            <Text className="mt-1 text-center text-sm text-muted">
              {"Thank you for shopping with Little Stepz. We'll get this packed right away!"}
            </Text>
          </View>
          <View className="rounded-xl bg-surface-2 px-4 py-3">
            <Text className="text-center text-xs text-muted">Order ID</Text>
            <Text className="mt-0.5 text-center text-sm font-jakarta-semibold text-text">{orderId}</Text>
          </View>
        </View>

        {order && !isLoading ? (
          <>
            {/* Items */}
            <View className="rounded-2xl border border-border bg-surface p-5">
              <View className="mb-4 flex-row items-center gap-2">
                <Ionicons name="cube-outline" size={15} color={colors.primary} />
                <Text className="text-sm font-jakarta-semibold text-text">
                  {items.length} {items.length === 1 ? "Item" : "Items"} Ordered
                </Text>
              </View>
              <View className="gap-3">
                {items.slice(0, 3).map((item) => {
                  const img = item.variant?.images?.[0]?.url || item.product?.images?.[0]?.url;
                  const lineTotal = Number(item.price ?? 0) * Number(item.quantity ?? 1);
                  return (
                    <View key={item.id ?? item.productId} className="flex-row items-center gap-3">
                      <View className="h-11 w-11 overflow-hidden rounded-lg border border-border bg-surface-2">
                        {img ? (
                          <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                        ) : (
                          <View className="h-full w-full items-center justify-center">
                            <Ionicons name="cube-outline" size={14} color={colors.faint} />
                          </View>
                        )}
                      </View>
                      <View className="flex-1">
                        <Text numberOfLines={1} className="text-sm font-jakarta-medium text-text">
                          {item.product?.name ?? "Product"}
                        </Text>
                        {item.variant?.name ? <Text className="text-xs text-muted">{item.variant.name}</Text> : null}
                        <Text className="text-xs text-muted">Qty: {item.quantity}</Text>
                      </View>
                      <Text className="text-sm font-jakarta-semibold text-text">{formatPrice(lineTotal)}</Text>
                    </View>
                  );
                })}
                {items.length > 3 ? (
                  <Text className="pt-1 text-center text-xs text-muted">+{items.length - 3} more items</Text>
                ) : null}
              </View>
            </View>

            {/* Totals + delivery */}
            <View className="flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-border bg-surface p-4">
                <Text className="mb-1 text-xs text-muted">Order Total</Text>
                <Text className="text-xl font-jakarta-bold text-text">{formatPrice(order.total)}</Text>
                <Text className="mt-1 text-xs capitalize text-muted">
                  via {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online"}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl border border-border bg-surface p-4">
                <View className="mb-1 flex-row items-center gap-1.5">
                  <Ionicons name="location-outline" size={12} color={colors.primary} />
                  <Text className="text-xs text-muted">Delivering to</Text>
                </View>
                {addr ? (
                  <>
                    <Text className="text-sm font-jakarta-semibold text-text">{addr.name}</Text>
                    <Text numberOfLines={1} className="mt-0.5 text-xs text-muted">
                      {addr.city}, {addr.state}
                    </Text>
                  </>
                ) : (
                  <Text className="text-sm text-muted">—</Text>
                )}
              </View>
            </View>
          </>
        ) : null}

        {/* CTAs */}
        <View className="gap-3">
          <Button label="Track Order" onPress={() => router.replace(`/orders/${orderId}`)} />
          <Button label="Continue Shopping" variant="outline" onPress={() => router.replace("/(tabs)/home")} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
