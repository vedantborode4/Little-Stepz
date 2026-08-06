import { useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AdminShell } from "../../features/admin/components/AdminShell";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  AdminPreOrderService,
  type AdminPreOrder,
  type AdminPreOrderStatus,
} from "../../features/admin/services/admin.services";
import { qk } from "../../lib/api/query-client";
import { toast } from "../../store/toast.store";
import { formatPrice, formatDate, shortId } from "../../lib/utils/format";
import { type ThemeColors } from "../../theme/tokens";
import { useThemeColors } from "../../theme/useThemeColors";

const STATUS_LABEL: Record<AdminPreOrderStatus, string> = {
  PENDING_BOOKING: "Pending booking",
  BOOKED: "Booked",
  AWAITING_BALANCE: "Awaiting balance",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

// Resolved per render so the tints follow the active colour scheme.
function statusTint(c: ThemeColors, status: AdminPreOrderStatus): string {
  switch (status) {
    case "BOOKED":
      return c.info;
    case "PENDING_BOOKING":
    case "AWAITING_BALANCE":
      return c.warning;
    case "COMPLETED":
      return c.success;
    case "CANCELLED":
      return c.danger;
    case "REFUNDED":
      return c.secondary;
    default:
      return c.muted;
  }
}

const FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Booked", value: "BOOKED" },
  { label: "Awaiting balance", value: "AWAITING_BALANCE" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function AdminPreOrders() {
  const colors = useThemeColors();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: qk.adminPreOrders({ status }),
    queryFn: () => AdminPreOrderService.list({ limit: 100, status: status || undefined }),
  });
  const preOrders = data?.preOrders ?? [];

  const run = async (id: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(okMsg);
      qc.invalidateQueries({ queryKey: ["admin", "pre-orders"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const confirm = (title: string, onYes: () => void) =>
    Alert.alert(title, "Are you sure?", [
      { text: "No", style: "cancel" },
      { text: "Yes", style: "destructive", onPress: onYes },
    ]);

  const renderItem = ({ item }: { item: AdminPreOrder }) => {
    const meta = { label: STATUS_LABEL[item.status] ?? item.status, tint: statusTint(colors, item.status) };
    const canRefund =
      (item.status === "BOOKED" || item.status === "AWAITING_BALANCE" || item.status === "EXPIRED") &&
      !!item.bookingPaidAt;
    const canCancel = !["COMPLETED", "CANCELLED", "REFUNDED"].includes(item.status);
    const canResend = item.status === "AWAITING_BALANCE";
    const disabled = busyId === item.id;

    return (
      <Card className="gap-1.5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text numberOfLines={1} className="font-jakarta-semibold text-text">{item.product.name}</Text>
            {item.variant?.name ? <Text className="text-xs text-muted">{item.variant.name}</Text> : null}
          </View>
          <View style={{ backgroundColor: meta.tint + "20" }} className="rounded-full px-2 py-0.5">
            <Text style={{ color: meta.tint }} className="text-xs font-jakarta-medium">{meta.label}</Text>
          </View>
        </View>

        <Text className="text-xs text-muted">
          {item.user.name} · {item.user.email}
        </Text>
        <View className="flex-row flex-wrap gap-x-4 gap-y-0.5">
          <Text className="text-xs text-muted">Qty {item.quantity}</Text>
          <Text className="text-xs text-muted">Booking {formatPrice(item.bookingAmount)}</Text>
          <Text className="text-xs text-muted">Balance {formatPrice(item.balanceAmount)}</Text>
          <Text className="text-xs text-muted">Total {formatPrice(item.totalAmount)}</Text>
        </View>
        <Text className="text-[11px] text-muted">#{shortId(item.id)} · {formatDate(item.createdAt)}</Text>

        <View className="mt-1 flex-row flex-wrap gap-2">
          {canResend ? (
            <Pressable
              disabled={disabled}
              onPress={() => run(item.id, () => AdminPreOrderService.resendLink(item.id), "Balance link resent")}
              className="rounded-lg border border-info/40 px-3 py-1.5"
            >
              <Text className="text-xs font-jakarta-medium text-info">Resend link</Text>
            </Pressable>
          ) : null}
          {canRefund ? (
            <Pressable
              disabled={disabled}
              onPress={() => confirm("Refund booking?", () => run(item.id, () => AdminPreOrderService.refundBooking(item.id), "Booking refunded"))}
              className="rounded-lg border border-border px-3 py-1.5"
            >
              <Text className="text-xs font-jakarta-medium" style={{ color: "#7E22CE" }}>Refund booking</Text>
            </Pressable>
          ) : null}
          {canCancel ? (
            <Pressable
              disabled={disabled}
              onPress={() => confirm("Cancel pre-order?", () => run(item.id, () => AdminPreOrderService.cancel(item.id), "Pre-order cancelled"))}
              className="rounded-lg border border-danger/40 px-3 py-1.5"
            >
              <Text className="text-xs font-jakarta-medium text-danger">Cancel</Text>
            </Pressable>
          ) : null}
          {item.orderId ? (
            <Pressable
              onPress={() => router.push({ pathname: "/admin/orders/[id]", params: { id: item.orderId! } })}
              className="rounded-lg border border-border px-3 py-1.5"
            >
              <Text className="text-xs font-jakarta-medium text-text">View order</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="pre-orders" title="Pre-Orders">
        <View className="border-b border-border">
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={FILTERS}
            keyExtractor={(f) => f.value || "all"}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            renderItem={({ item: f }) => {
              const on = status === f.value;
              return (
                <Pressable
                  onPress={() => setStatus(f.value)}
                  className={`rounded-full border px-3 py-1.5 ${on ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
                >
                  <Text className={on ? "text-xs font-jakarta-semibold text-primary" : "text-xs text-muted"}>{f.label}</Text>
                </Pressable>
              );
            }}
          />
        </View>
        <FlatList
          data={preOrders}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          renderItem={renderItem}
          ListEmptyComponent={isLoading ? null : <EmptyState icon="time-outline" title="No pre-orders" />}
        />
      </AdminShell>
    </ScreenContainer>
  );
}
