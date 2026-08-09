import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { PagedList } from "../../../components/ui/PagedList";
import { Card } from "../../../components/ui/Card";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SelectSheet } from "../../../components/ui/SelectSheet";
import { AdminOrderService, type AdminOrder } from "../../../features/admin/services/admin.services";
import { useAdminUi } from "../../../features/admin/store";
import { ORDER_STATUS, ORDER_STATUS_VALUES } from "../../../lib/enums";
import { formatDate, formatPrice, shortId } from "../../../lib/utils/format";

export default function AdminOrders() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const setSelectedOrder = useAdminUi((s) => s.setSelectedOrder);

  const query = useInfiniteQuery({
    queryKey: ["admin", "orders", status],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => AdminOrderService.getOrders({ page: pageParam, limit: 20, status: status as any }),
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
  });

  const statusOptions = useMemo(
    () => [{ label: "All statuses", value: "" }, ...ORDER_STATUS_VALUES.map((s) => ({ label: ORDER_STATUS[s].label, value: s }))],
    []
  );

  const open = (o: AdminOrder) => {
    setSelectedOrder(o);
    router.push(`/admin/orders/${o.id}`);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="orders" title="Orders">
        <View className="px-4 pt-3">
          <SelectSheet
            placeholder="Filter by status"
            value={status ?? ""}
            options={statusOptions}
            onChange={(v) => setStatus(v || undefined)}
          />
        </View>
        <PagedList<AdminOrder>
          query={query}
          flatten={(d) => d.pages.flatMap((p: any) => p.orders ?? [])}
          keyExtractor={(o) => o.id}
          emptyIcon="receipt-outline"
          emptyTitle="No orders"
          renderItem={(o) => (
            <Pressable onPress={() => open(o)}>
              <Card className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text className="font-jakarta-semibold text-text">#{shortId(o.id)}</Text>
                  <StatusBadge value={o.status} map={ORDER_STATUS} />
                </View>
                <Text className="text-sm text-muted">{o.user?.name ?? "Customer"} · {formatDate(o.createdAt)}</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-muted">{o.paymentMethod}</Text>
                  <Text className="font-jakarta-bold text-text">{formatPrice(o.total)}</Text>
                </View>
              </Card>
            </Pressable>
          )}
        />
      </AdminShell>
    </ScreenContainer>
  );
}
