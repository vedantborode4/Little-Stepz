import { Alert, Text, View } from "react-native";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AdminShell } from "../../features/admin/components/AdminShell";
import { PagedList } from "../../components/ui/PagedList";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { AdminWithdrawalService, type AdminWithdrawal } from "../../features/admin/services/admin.services";
import { WITHDRAWAL_STATUS } from "../../lib/enums";
import { formatPrice, formatDate } from "../../lib/utils/format";
import { toast } from "../../store/toast.store";

export default function AdminWithdrawals() {
  const qc = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ["admin", "withdrawals"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => AdminWithdrawalService.getAll({ page: pageParam, limit: 20 }),
    getNextPageParam: (last: any) => {
      const pg = last.pagination;
      return pg && pg.page < pg.pages ? pg.page + 1 : undefined;
    },
  });

  const process = (w: AdminWithdrawal, status: "PAID" | "REJECTED") => {
    Alert.alert(`Mark ${status}`, `Withdrawal of ${formatPrice(w.amount)}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await AdminWithdrawalService.process(w.id, { status });
            toast.success(`Marked ${status.toLowerCase()}`);
            qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
          } catch (e: any) {
            toast.error(e?.response?.data?.message || "Action failed");
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="withdrawals" title="Withdrawals">
        <PagedList<AdminWithdrawal>
          query={query}
          flatten={(d) => d.pages.flatMap((p: any) => p.withdrawals ?? [])}
          keyExtractor={(w) => w.id}
          emptyIcon="wallet-outline"
          emptyTitle="No withdrawal requests"
          renderItem={(w) => (
            <Card className="gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="font-jakarta-semibold text-text">{w.affiliate?.user?.name ?? "Affiliate"}</Text>
                <StatusBadge value={w.status} map={WITHDRAWAL_STATUS} />
              </View>
              <Text className="text-sm text-muted">{w.affiliate?.user?.email} · {formatDate(w.createdAt)}</Text>
              <Text className="font-jakarta-bold text-text">{formatPrice(w.amount)}</Text>
              {w.status === "PENDING" || w.status === "PROCESSING" ? (
                <View className="mt-1 flex-row gap-3">
                  <View className="flex-1"><Button label="Mark Paid" onPress={() => process(w, "PAID")} /></View>
                  <View className="flex-1"><Button label="Reject" variant="danger" onPress={() => process(w, "REJECTED")} /></View>
                </View>
              ) : null}
            </Card>
          )}
        />
      </AdminShell>
    </ScreenContainer>
  );
}
