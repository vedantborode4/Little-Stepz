import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../ui/Card";
import { StatusBadge } from "../ui/StatusBadge";
import { ORDER_STATUS } from "../../lib/enums";
import { formatDate, formatPrice, shortId } from "../../lib/utils/format";
import { colors } from "../../theme/tokens";
import type { Order } from "../../types/order";

export function OrderCard({ order }: { order: Order }) {
  const itemCount = order.items?.length ?? 0;
  const images = (order.items ?? [])
    .map((i) => i.product?.images?.[0]?.url)
    .filter(Boolean)
    .slice(0, 3) as string[];

  return (
    <Pressable onPress={() => router.push(`/orders/${order.id}`)}>
      <Card className="gap-3">
        {/* Top row */}
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-[10px] font-jakarta-medium uppercase tracking-wide text-muted">Order</Text>
            <Text className="text-xs font-jakarta-medium text-text">#{shortId(order.id)}</Text>
            <Text className="mt-0.5 text-xs text-muted">{formatDate(order.createdAt)}</Text>
          </View>
          <StatusBadge value={order.status} map={ORDER_STATUS} />
        </View>

        {/* Thumbnails */}
        <View className="flex-row gap-2">
          {images.length > 0
            ? images.map((url, idx) => (
                <View key={idx} className="h-14 w-14 overflow-hidden rounded-xl border border-border bg-surface-2">
                  <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                </View>
              ))
            : (
              <View className="h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border bg-surface-2">
                <Ionicons name="cube-outline" size={16} color={colors.faint} />
              </View>
            )}
          {itemCount > 3 ? (
            <View className="h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface-2">
              <Text className="text-xs font-jakarta-semibold text-muted">+{itemCount - 3}</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom row */}
        <View className="flex-row items-center justify-between border-t border-border pt-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-muted">{itemCount} {itemCount === 1 ? "item" : "items"}</Text>
            <Text className="text-border">•</Text>
            <Text className="text-sm font-jakarta-bold text-text">{formatPrice(order.total)}</Text>
            {/* An outstanding balance is the one thing about this order the customer
                needs to see without opening it. */}
            {order.partial?.balanceStatus === "DUE" ? (
              <View className="rounded-full bg-warning/10 px-2 py-0.5">
                <Text className="text-[10px] font-jakarta-semibold text-warning">
                  {formatPrice(order.partial.balanceAmount)} {order.partial.collectedAtDoor ? "at delivery" : "due"}
                </Text>
              </View>
            ) : null}
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-xs font-jakarta-medium text-primary">View details</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
