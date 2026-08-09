import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SelectSheet } from "../../../components/ui/SelectSheet";
import { EmptyState } from "../../../components/ui/EmptyState";
import { AdminOrderService } from "../../../features/admin/services/admin.services";
import { useAdminUi } from "../../../features/admin/store";
import { ORDER_STATUS, ORDER_STATUS_VALUES } from "../../../lib/enums";
import { formatDate, formatPrice, shortId } from "../../../lib/utils/format";
import { toast } from "../../../store/toast.store";

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useAdminUi((s) => s.selectedOrder);
  const setSelectedOrder = useAdminUi((s) => s.setSelectedOrder);
  const qc = useQueryClient();

  const [newStatus, setNewStatus] = useState<string>(order?.status ?? "PENDING");
  const [busy, setBusy] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "orders"] });

  if (!order || order.id !== id) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <AdminShell active="orders" title="Order">
          <EmptyState icon="receipt-outline" title="Open from the orders list" subtitle="Order details are loaded from the list." />
        </AdminShell>
      </ScreenContainer>
    );
  }

  const updateStatus = async () => {
    setBusy(true);
    try {
      await AdminOrderService.updateStatus(order.id, newStatus);
      setSelectedOrder({ ...order, status: newStatus });
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
    Alert.alert(`${action === "APPROVE" ? "Approve" : "Reject"} return`, "Confirm?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await AdminOrderService.resolveReturn(order.id, { action });
            toast.success("Return resolved");
            invalidate();
          } catch (e: any) {
            toast.error(e?.response?.data?.message || "Could not resolve return");
          }
        },
      },
    ]);
  };

  const addr = order.shippingAddress;

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
            <Text className="text-sm text-text">{order.paymentMethod} · {formatPrice(order.total)}</Text>
          </Card>

          {addr ? (
            <Card className="gap-0.5">
              <Text className="font-jakarta-semibold text-text">Shipping address</Text>
              <Text className="text-sm text-muted">
                {addr.name}, {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
              </Text>
            </Card>
          ) : null}

          <Card className="gap-3">
            <Text className="font-jakarta-semibold text-text">Update status</Text>
            <SelectSheet
              value={newStatus}
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
