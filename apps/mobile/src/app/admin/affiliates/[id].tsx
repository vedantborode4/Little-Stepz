import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { AdminAffiliateService } from "../../../features/admin/services/admin.services";
import { AFFILIATE_STATUS } from "../../../lib/enums";
import { formatPrice } from "../../../lib/utils/format";
import { qk } from "../../../lib/api/query-client";
import { toast } from "../../../store/toast.store";

export default function AdminAffiliateDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: qk.adminAffiliate(id),
    queryFn: () => AdminAffiliateService.getById(id),
    enabled: !!id,
  });

  const affiliate = data?.affiliate ?? data;
  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (affiliate?.commissionRate != null) setRate(String(affiliate.commissionRate));
  }, [affiliate?.commissionRate]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.adminAffiliate(id) });
    qc.invalidateQueries({ queryKey: ["admin", "affiliates"] });
  };

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="affiliates" title="Affiliate">
        {isLoading ? null : isError || !affiliate ? (
          <EmptyState icon="people-outline" title="Affiliate not found" />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Card className="gap-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-jakarta-semibold text-text">{affiliate.user?.name}</Text>
                <StatusBadge value={affiliate.status} map={AFFILIATE_STATUS} />
              </View>
              <Text className="text-sm text-muted">{affiliate.user?.email}</Text>
              <Text className="text-sm text-muted">Code: {affiliate.referralCode}</Text>
            </Card>

            <View className="flex-row gap-3">
              <Card className="flex-1 gap-0.5">
                <Text className="text-xs text-muted">Conversions</Text>
                <Text className="text-lg font-jakarta-bold text-text">{affiliate.totalConversions ?? 0}</Text>
              </Card>
              <Card className="flex-1 gap-0.5">
                <Text className="text-xs text-muted">Earnings</Text>
                <Text className="text-lg font-jakarta-bold text-text">{formatPrice(affiliate.totalCommission ?? 0)}</Text>
              </Card>
            </View>

            <Card className="gap-3">
              <Text className="font-jakarta-semibold text-text">Commission rate</Text>
              <Input label="Rate (e.g. 0.05 = 5%)" keyboardType="numeric" value={rate} onChangeText={setRate} />
              <Input label="Admin note" value={note} onChangeText={setNote} />
            </Card>

            <View className="gap-2">
              {affiliate.status === "PENDING" ? (
                <>
                  <Button label="Approve" loading={busy} onPress={() => run(() => AdminAffiliateService.approve(id, { commissionRate: rate ? Number(rate) : undefined, adminNote: note || undefined }), "Approved")} />
                  <Button label="Reject" variant="danger" loading={busy} onPress={() => run(() => AdminAffiliateService.reject(id, { adminNote: note || undefined }), "Rejected")} />
                </>
              ) : (
                <Button label="Update Commission" loading={busy} onPress={() => run(() => AdminAffiliateService.update(id, { commissionRate: rate ? Number(rate) : undefined, adminNote: note || undefined }), "Updated")} />
              )}
            </View>
          </ScrollView>
        )}
      </AdminShell>
    </ScreenContainer>
  );
}
