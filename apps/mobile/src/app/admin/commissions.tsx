import { Alert, Text, View } from "react-native";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AdminShell } from "../../features/admin/components/AdminShell";
import { PagedList } from "../../components/ui/PagedList";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { AdminCommissionService, type AdminCommission } from "../../features/admin/services/admin.services";
import { COMMISSION_STATUS } from "../../lib/enums";
import { formatPrice, formatDate } from "../../lib/utils/format";
import { toast } from "../../store/toast.store";

export default function AdminCommissions() {
  const qc = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ["admin", "commissions"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => AdminCommissionService.getAll({ page: pageParam, limit: 20 }),
    getNextPageParam: (last: any) => {
      const pg = last.pagination;
      return pg && pg.page < pg.pages ? pg.page + 1 : undefined;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "commissions"] });

  const approve = (c: AdminCommission) => {
    Alert.alert("Approve commission", formatPrice(c.amount), [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: async () => {
        try { await AdminCommissionService.approve(c.id); toast.success("Approved"); invalidate(); }
        catch (e: any) { toast.error(e?.response?.data?.message || "Failed"); }
      } },
    ]);
  };

  const pay = (c: AdminCommission) => {
    Alert.alert("Mark paid", formatPrice(c.amount), [
      { text: "Cancel", style: "cancel" },
      { text: "Mark Paid", onPress: async () => {
        try { await AdminCommissionService.markPaid(c.id); toast.success("Marked paid"); invalidate(); }
        catch (e: any) { toast.error(e?.response?.data?.message || "Failed"); }
      } },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="commissions" title="Commissions">
        <PagedList<AdminCommission>
          query={query}
          flatten={(d) => d.pages.flatMap((p: any) => p.commissions ?? [])}
          keyExtractor={(c) => c.id}
          emptyIcon="cash-outline"
          emptyTitle="No commissions"
          renderItem={(c) => (
            <Card className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="font-jakarta-semibold text-text">{c.affiliate?.user?.name ?? "Affiliate"}</Text>
                <StatusBadge value={c.status} map={COMMISSION_STATUS} />
              </View>
              <Text className="text-sm text-muted">{formatDate(c.createdAt)} · Order {formatPrice(c.order?.total ?? 0)}</Text>
              <Text className="font-jakarta-bold text-text">{formatPrice(c.amount)}</Text>
              <View className="mt-1 flex-row gap-3">
                {c.status === "PENDING" ? (
                  <View className="flex-1"><Button label="Approve" onPress={() => approve(c)} /></View>
                ) : null}
                {c.status === "APPROVED" ? (
                  <View className="flex-1"><Button label="Mark Paid" onPress={() => pay(c)} /></View>
                ) : null}
              </View>
            </Card>
          )}
        />
      </AdminShell>
    </ScreenContainer>
  );
}
