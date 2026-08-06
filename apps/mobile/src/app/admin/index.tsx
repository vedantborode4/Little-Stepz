import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/tokens";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AdminShell } from "../../features/admin/components/AdminShell";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { RevenueChart, OrderStatusDonut } from "../../features/admin/components/Charts";
import { AdminService } from "../../features/admin/services/admin.services";
import { qk } from "../../lib/api/query-client";
import { formatPrice } from "../../lib/utils/format";

const QUICK_LINKS: { label: string; route: string; icon: keyof typeof Ionicons.glyphMap; tint: string }[] = [
  { label: "Orders", route: "/admin/orders", icon: "receipt-outline", tint: "#2563EB" },
  { label: "Products", route: "/admin/products", icon: "cube-outline", tint: "#16A34A" },
  { label: "Profit & Loss", route: "/admin/profit-loss", icon: "trending-up-outline", tint: "#16A34A" },
  { label: "Affiliates", route: "/admin/affiliates", icon: "people-outline", tint: "#7E22CE" },
  { label: "Coupons", route: "/admin/coupons", icon: "pricetag-outline", tint: "#D97706" },
  { label: "Pre-Orders", route: "/admin/pre-orders", icon: "time-outline", tint: "#0891B2" },
];

export default function AdminDashboard() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: qk.adminStats,
    queryFn: () => AdminService.getStats(),
  });

  const k = data?.kpis;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="dashboard" title="Dashboard">
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {isLoading ? (
            <Text className="py-10 text-center text-muted">Loading…</Text>
          ) : (
            <>
              <View className="flex-row gap-3">
                <StatCard label="Revenue (30d)" value={formatPrice(k?.revenueLast30d ?? 0)} icon="trending-up-outline" tint="#16A34A" />
                <StatCard label="Total orders" value={String(k?.totalOrders ?? 0)} icon="receipt-outline" tint="#2563EB" />
              </View>
              <View className="flex-row gap-3">
                <StatCard label="Avg order" value={formatPrice(k?.avgOrderValue ?? 0)} icon="cart-outline" />
                <StatCard label="Users" value={String(k?.totalUsers ?? 0)} icon="people-outline" tint="#7E22CE" />
              </View>
              <View className="flex-row gap-3">
                <StatCard label="Low stock" value={String(k?.lowStockProducts ?? 0)} icon="alert-circle-outline" tint="#D97706" />
                <StatCard label="Pending returns" value={String(k?.pendingReturns ?? 0)} icon="refresh-outline" tint="#DC2626" />
              </View>

              <RevenueChart data={data?.revenueChart ?? []} />
              <OrderStatusDonut data={data?.ordersByStatus ?? {}} />

              {data?.topProducts && data.topProducts.length > 0 ? (
                <Card className="gap-2">
                  <Text className="font-jakarta-semibold text-text">Top products</Text>
                  {data.topProducts.slice(0, 5).map((p) => (
                    <View key={p.productId} className="flex-row items-center justify-between">
                      <Text numberOfLines={1} className="flex-1 pr-2 text-sm text-text">{p.name}</Text>
                      <Text className="text-sm text-muted">{p.totalQuantity} sold</Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              {/* Commissions summary */}
              {(data as any)?.commissions ? (
                <Card className="gap-2">
                  <Text className="font-jakarta-semibold text-text">Commissions</Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-warning">Pending</Text>
                    <Text className="text-sm font-jakarta-medium text-text">
                      {formatPrice((data as any).commissions.pending?.amount ?? 0)} · {(data as any).commissions.pending?.count ?? 0}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-success">Approved</Text>
                    <Text className="text-sm font-jakarta-medium text-text">
                      {formatPrice((data as any).commissions.approved?.amount ?? 0)} · {(data as any).commissions.approved?.count ?? 0}
                    </Text>
                  </View>
                  {(data as any)?.payments?.successRate ? (
                    <View className="flex-row items-center justify-between border-t border-border pt-2">
                      <Text className="text-sm text-muted">Payment success rate</Text>
                      <Text className="text-sm font-jakarta-semibold text-text">{(data as any).payments.successRate}</Text>
                    </View>
                  ) : null}
                </Card>
              ) : null}

              {/* Quick links */}
              <View className="flex-row flex-wrap gap-3">
                {QUICK_LINKS.map((q) => (
                  <Pressable key={q.route} onPress={() => router.push(q.route as any)} className="flex-1 basis-[45%]">
                    <Card className="flex-row items-center gap-2.5">
                      <View style={{ backgroundColor: q.tint + "20" }} className="h-9 w-9 items-center justify-center rounded-xl">
                        <Ionicons name={q.icon} size={16} color={q.tint} />
                      </View>
                      <Text className="text-sm font-jakarta-medium text-text">{q.label}</Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </AdminShell>
    </ScreenContainer>
  );
}
