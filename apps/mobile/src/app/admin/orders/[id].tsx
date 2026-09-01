import { useState } from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SelectSheet } from "../../../components/ui/SelectSheet";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { AdminOrderService } from "../../../features/admin/services/admin.services";
import { ORDER_STATUS, ORDER_STATUS_VALUES } from "../../../lib/enums";
import { formatDate, formatPrice, shortId } from "../../../lib/utils/format";
import { toast } from "../../../store/toast.store";

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  // The screen used to read the order out of the admin store, which is filled from
  // the orders *list* — a payload with no items and no address. Deep links and a
  // reload therefore showed "Open from the orders list", and even the happy path
  // rendered `order.shippingAddress`, a field that does not exist on the model.
  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ["admin", "orders", id],
    queryFn: () => AdminOrderService.getById(id),
    enabled: !!id,
  });

  const [newStatus, setNewStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    refetch();
  };

  if (isLoading) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <AdminShell active="orders" title="Order">
          <View className="gap-3 p-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </View>
        </AdminShell>
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <AdminShell active="orders" title="Order">
          <EmptyState icon="receipt-outline" title="Order not found" subtitle="It may have been removed." />
        </AdminShell>
      </ScreenContainer>
    );
  }

  const status = newStatus ?? order.status;

  const updateStatus = async () => {
    setBusy(true);
    try {
      await AdminOrderService.updateStatus(order.id, status);
      toast.success("Status updated");
      invalidate();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not update status");
    } finally {
      setBusy(false);
    }
  };

  const ship = async () => {
    setBusy(true);
    try {
      await AdminOrderService.createShipment(order.id);
      toast.success("Shipment created");
      invalidate();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not create shipment");
    } finally {
      setBusy(false);
    }
  };

  const resolveReturn = (action: "APPROVE" | "REJECT") => {
    // The route resolves a Return, so it needs the Return's id — passing `order.id` here
    // meant the request addressed a resource that does not exist.
    if (!order.returnId) {
      toast.error("No return request found for this order.");
      return;
    }
    Alert.alert(`${action === "APPROVE" ? "Approve" : "Reject"} return`, "Confirm?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await AdminOrderService.resolveReturn(order.returnId!, {
              status: action === "APPROVE" ? "APPROVED" : "REJECTED",
            });
            toast.success("Return resolved");
            invalidate();
          } catch (e: any) {
            toast.error(e?.response?.data?.message || "Could not resolve return");
          }
        },
      },
    ]);
  };

  const addr = order.address;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="orders" title={`#${shortId(order.id)}`}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Card className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-jakarta-semibold text-text">Status</Text>
              <StatusBadge value={order.status} map={ORDER_STATUS} />
            </View>
            <Text className="text-sm text-muted">{order.user?.name} · {formatDate(order.createdAt)}</Text>
            {order.user?.email ? <Text className="text-sm text-muted">{order.user.email}</Text> : null}
            <Text className="text-sm text-text">{order.paymentMethod} · {formatPrice(order.total)}</Text>
            {order.payment ? (
              <Text className="text-sm text-muted">Payment: {order.payment.status}</Text>
            ) : null}
            {order.shipments[0]?.awbCode ? (
              <Text className="text-sm text-muted">
                {order.shipments[0].courierName ?? "Courier"} · AWB {order.shipments[0].awbCode}
              </Text>
            ) : null}
          </Card>

          {addr ? (
            <Card className="gap-0.5">
              <Text className="font-jakarta-semibold text-text">Shipping address</Text>
              <Text className="text-sm text-muted">{addr.name} · {addr.phone}</Text>
              <Text className="text-sm text-muted">
                {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
              </Text>
            </Card>
          ) : null}

          <Card className="gap-3">
            <Text className="font-jakarta-semibold text-text">Items ({order.items.length})</Text>
            {order.items.map((item) => (
              <View key={item.id} className="flex-row items-center gap-3">
                {item.image ? (
                  <Image source={{ uri: item.image }} className="h-12 w-12 rounded-xl" />
                ) : (
                  <View className="h-12 w-12 rounded-xl bg-surface-2" />
                )}
                <View className="flex-1">
                  <Text className="text-sm text-text" numberOfLines={2}>{item.productName}</Text>
                  {item.variantName ? <Text className="text-xs text-muted">{item.variantName}</Text> : null}
                  <Text className="text-xs text-muted">Qty {item.quantity} × {formatPrice(item.price)}</Text>
                </View>
                <Text className="text-sm font-jakarta-semibold text-text">{formatPrice(item.subtotal)}</Text>
              </View>
            ))}

            <View className="gap-1 border-t border-border pt-3">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Subtotal</Text>
                <Text className="text-sm text-muted">{formatPrice(order.subtotal)}</Text>
              </View>
              {order.discount > 0 ? (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Discount{order.coupon ? " (" + order.coupon.code + ")" : ""}</Text>
                  <Text className="text-sm text-muted">-{formatPrice(order.discount)}</Text>
                </View>
              ) : null}
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Shipping</Text>
                <Text className="text-sm text-muted">{formatPrice(order.shippingCharges)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="font-jakarta-semibold text-text">Total</Text>
                <Text className="font-jakarta-semibold text-text">{formatPrice(order.total)}</Text>
              </View>
            </View>
          </Card>

          <Card className="gap-3">
            <Text className="font-jakarta-semibold text-text">Update status</Text>
            <SelectSheet
              value={status}
              options={ORDER_STATUS_VALUES.map((s) => ({ label: ORDER_STATUS[s].label, value: s }))}
              onChange={setNewStatus}
            />
            <Button label="Save Status" loading={busy} onPress={updateStatus} />
          </Card>

          <View className="gap-2">
            <Button label="Create Shipment" variant="outline" onPress={ship} />
            {order.status === "RETURN_REQUESTED" ? (
              <>
                <Button label="Approve Return" onPress={() => resolveReturn("APPROVE")} />
                <Button label="Reject Return" variant="danger" onPress={() => resolveReturn("REJECT")} />
              </>
            ) : null}
          </View>
        </ScrollView>
      </AdminShell>
    </ScreenContainer>
  );
}
