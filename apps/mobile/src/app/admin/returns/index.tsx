import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { Card } from "../../../components/ui/Card";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { AdminReturnService } from "../../../features/admin/services/admin-returns.service";
import type { ReturnStatus } from "../../../lib/services/return.service";
import { RETURN_STATUS } from "../../../lib/enums";
import { qk } from "../../../lib/api/query-client";
import { formatDate, formatPrice, shortId } from "../../../lib/utils/format";
import { colors } from "../../../theme/tokens";

// Aligned with web (apps/web/app/admin/returns/page.tsx)
const TABS: { label: string; status?: ReturnStatus }[] = [
  { label: "To review", status: "PENDING" },
  { label: "Awaiting pickup", status: "APPROVED" },
  { label: "In transit", status: "PICKED_UP" },
  { label: "Refund pending", status: "RECEIVED" },
  { label: "Refunded", status: "REFUNDED" },
  { label: "All" },
];

export default function AdminReturns() {
  const [tab, setTab] = useState(0);
  const status = TABS[tab]!.status;
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: qk.adminReturns(status),
    queryFn: () => AdminReturnService.list({ status, limit: 50 }),
  });

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="returns" title="Returns">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0 border-b border-border" contentContainerStyle={{ gap: 8, padding: 12 }}>
          {TABS.map((t, i) => (
            <Pressable
              key={t.label}
              onPress={() => setTab(i)}
              className={`rounded-full border px-3 py-1.5 ${i === tab ? "border-primary bg-primary" : "border-border"}`}
            >
              <Text className={i === tab ? "text-xs font-jakarta-semibold text-white" : "text-xs text-muted"}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          {isLoading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          ) : !data?.returns.length ? (
            <EmptyState icon="return-down-back-outline" title="No returns here" />
          ) : (
            data.returns.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push((r.kind === "ITEM" ? `/admin/returns/${r.id}` : `/admin/orders/${r.orderId}`) as any)}
              >
                <Card className="gap-1.5">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="font-jakarta-semibold text-text">Order #{shortId(r.orderId)}</Text>
                    <StatusBadge value={r.status} map={RETURN_STATUS} />
                  </View>
                  <Text numberOfLines={1} className="text-sm text-muted">
                    {r.customer.name} · {r.reason}{r.units ? ` · ${r.units} unit${r.units === 1 ? "" : "s"}` : ""}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted">
                      {formatDate(r.createdAt)} · {r.order.paymentMethod === "COD" ? "COD" : r.order.paymentPlan === "PARTIAL" ? "Deposit" : "Online"}
                      {r.kind === "LEGACY" ? " · whole order" : ""}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      {r.hasEvidence ? <Ionicons name="camera-outline" size={14} color={colors.muted} /> : null}
                      {r.refundAmount != null ? <Text className="text-sm font-jakarta-semibold text-text">{formatPrice(r.refundAmount)}</Text> : null}
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))
          )}
        </ScrollView>
      </AdminShell>
    </ScreenContainer>
  );
}
