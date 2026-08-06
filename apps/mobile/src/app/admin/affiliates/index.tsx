import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { PagedList } from "../../../components/ui/PagedList";
import { Card } from "../../../components/ui/Card";
import { StatCard } from "../../../components/ui/StatCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SelectSheet } from "../../../components/ui/SelectSheet";
import { AdminAffiliateService, type AdminAffiliate } from "../../../features/admin/services/admin.services";
import { AFFILIATE_STATUS } from "../../../lib/enums";
import { formatPrice } from "../../../lib/utils/format";
import { colors } from "../../../theme/tokens";

export default function AdminAffiliates() {
  const [status, setStatus] = useState<string | undefined>(undefined);

  const { data: stats } = useQuery({
    queryKey: ["admin", "affiliate-stats"],
    queryFn: () => AdminAffiliateService.getStats(),
  });

  const query = useInfiniteQuery({
    queryKey: ["admin", "affiliates", status],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => AdminAffiliateService.getAll({ page: pageParam, limit: 20, status }),
    getNextPageParam: (last: any) => {
      const pg = last.pagination;
      return pg && pg.page < pg.pages ? pg.page + 1 : undefined;
    },
  });

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="affiliates" title="Affiliates">
        {stats ? (
          <View className="px-4 pt-3">
            <View className="flex-row gap-3">
              <StatCard label="Affiliates" value={String(stats.affiliates.total)} icon="people-outline" sub={`${stats.affiliates.approved} approved · ${stats.affiliates.pending} pending`} />
              <StatCard label="Earned" value={formatPrice(stats.commissions.earned)} icon="cash-outline" tint={colors.success} sub={`${formatPrice(stats.commissions.paid)} paid`} />
            </View>
            <View className="mt-3 flex-row gap-3">
              <StatCard label="Withdrawals" value={formatPrice(stats.withdrawals.pendingAmount)} icon="wallet-outline" tint={colors.warning} sub={`${stats.withdrawals.pendingCount} pending`} />
              <StatCard label="Ref. Revenue" value={formatPrice(stats.referrals.revenue)} icon="trending-up-outline" tint={colors.info ?? colors.primary} sub={`${stats.referrals.orders} orders · ${stats.referrals.signups} signups`} />
            </View>
          </View>
        ) : null}
        <View className="px-4 pt-3">
          <SelectSheet
            placeholder="Filter by status"
            value={status ?? ""}
            options={[
              { label: "All", value: "" },
              { label: "Pending", value: "PENDING" },
              { label: "Approved", value: "APPROVED" },
              { label: "Rejected", value: "REJECTED" },
            ]}
            onChange={(v) => setStatus(v || undefined)}
          />
        </View>
        <PagedList<AdminAffiliate>
          query={query}
          flatten={(d) => d.pages.flatMap((p: any) => p.affiliates ?? [])}
          keyExtractor={(a) => a.id}
          emptyIcon="people-outline"
          emptyTitle="No affiliates"
          renderItem={(a) => (
            <Pressable onPress={() => router.push(`/admin/affiliates/${a.id}`)}>
              <Card className="gap-1">
                <View className="flex-row items-center justify-between">
                  <Text className="font-jakarta-semibold text-text">{a.user?.name}</Text>
                  <StatusBadge value={a.status} map={AFFILIATE_STATUS} />
                </View>
                <Text className="text-sm text-muted">{a.user?.email}</Text>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted">{a.totalConversions} conversions</Text>
                  <Text className="text-xs font-jakarta-medium text-text">{formatPrice(a.totalCommission)}</Text>
                </View>
              </Card>
            </Pressable>
          )}
        />
      </AdminShell>
    </ScreenContainer>
  );
}
