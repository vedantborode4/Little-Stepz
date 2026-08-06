import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PreOrderService, type PreOrderStatus } from "../../lib/services/preorder.service";
import { formatPrice, formatDate } from "../../lib/utils/format";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

const LABEL: Record<PreOrderStatus, string> = {
  PENDING_BOOKING: "Pending",
  BOOKED: "Awaiting restock",
  AWAITING_BALANCE: "Balance due",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const COLOR: Record<PreOrderStatus, string> = {
  PENDING_BOOKING: "text-muted",
  BOOKED: "text-info",
  AWAITING_BALANCE: "text-warning",
  COMPLETED: "text-success",
  EXPIRED: "text-muted",
  CANCELLED: "text-danger",
  REFUNDED: "text-secondary",
};

export default function MyPreOrders() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["pre-orders"],
    queryFn: () => PreOrderService.getMine(),
  });

  const payBalance = async (token: string) => {
    setBusyId(token);
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
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not start payment");
    } finally {
      setBusyId(null);
    }
  };

  const items = data ?? [];

  return (
    <ScreenContainer>
      <Header title="My Pre-Orders" />
      {isLoading ? (
        <View className="flex-1 items-center justify-center"><Text className="text-muted">Loading…</Text></View>
      ) : items.length === 0 ? (
        <EmptyState icon="time-outline" title="No pre-orders yet" subtitle="Reserve out-of-stock items and they'll appear here." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {items.map((po) => (
            <Card key={po.id} className="flex-row items-center gap-3">
              <Image source={{ uri: po.product.images?.[0]?.url }} style={{ width: 60, height: 60, borderRadius: 10 }} contentFit="contain" />
              <View className="flex-1">
                <Text numberOfLines={1} className="font-jakarta-medium text-text">{po.product.name}</Text>
                <Text className="text-xs text-muted">
                  {po.variant?.name ? `${po.variant.name} · ` : ""}Qty {po.quantity} · Total {formatPrice(po.totalAmount)}
                </Text>
                <Text className="text-xs text-muted">
                  Booking {formatPrice(po.bookingAmount)}
                  {po.bookingPaidAt ? ` · paid ${formatDate(po.bookingPaidAt)}` : ""}
                </Text>
                {po.status === "AWAITING_BALANCE" ? (
                  <Text className="text-xs text-muted">
                    Balance {formatPrice(po.balanceAmount)}
                    {po.balanceDueAt ? ` · due by ${formatDate(po.balanceDueAt)}` : ""}
                  </Text>
                ) : null}
                <Text className={`mt-1 text-xs font-jakarta-semibold ${COLOR[po.status]}`}>{LABEL[po.status]}</Text>
                {po.orderId ? (
                  <Text onPress={() => router.push(`/orders/${po.orderId}`)} className="mt-0.5 text-xs font-jakarta-medium text-primary">
                    View linked order →
                  </Text>
                ) : null}
              </View>
              {po.status === "AWAITING_BALANCE" && po.balanceToken ? (
                <Button
                  label={`Pay ${formatPrice(po.balanceAmount)}`}
                  loading={busyId === po.balanceToken}
                  onPress={() => payBalance(po.balanceToken!)}
                  className="px-3"
                />
              ) : po.status === "COMPLETED" && po.orderId ? (
                <Ionicons name="chevron-forward" size={18} color={colors.faint} onPress={() => router.push(`/orders/${po.orderId}`)} />
              ) : null}
            </Card>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
