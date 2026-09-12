import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { AdminAffiliateService } from "../../../features/admin/services/admin.services";
import { AFFILIATE_STATUS, COMMISSION_STATUS } from "../../../lib/enums";
import { formatDate, formatPrice, shortId } from "../../../lib/utils/format";
import { qk } from "../../../lib/api/query-client";
import { toast } from "../../../store/toast.store";
import { getErrorMessage } from "../../../lib/utils/errors";

interface RecentCommission {
  id: string;
  orderId: string | null;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  order?: { total: number; status: string; paymentMethod: string } | null;
}

/** Commission rate is stored as a fraction (0.05); older rows may hold a percentage. */
const ratePercent = (rate: unknown) => {
  const n = Number(rate ?? 0);
  return n <= 1 ? `${(n * 100).toFixed(1)}%` : `${n}%`;
};

export default function AdminAffiliateDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: qk.adminAffiliate(id),
    queryFn: () => AdminAffiliateService.getById(id),
    enabled: !!id,
  });

  const affiliate = data?.affiliate ?? data;
  // The detail endpoint returns `user` alongside `affiliate`, not inside it — reading
  // `affiliate.user` left the name and email blank.
  const affiliateUser = data?.user ?? affiliate?.user;
  const commissions: RecentCommission[] = data?.recentCommissions ?? [];
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
      toast.error(getErrorMessage(e, "Action failed"));
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
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
            <Card className="gap-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-jakarta-semibold text-text">{affiliateUser?.name ?? "—"}</Text>
                <StatusBadge value={affiliate.status} map={AFFILIATE_STATUS} />
              </View>
              {affiliateUser?.email ? <Text className="text-sm text-muted">{affiliateUser.email}</Text> : null}
              {affiliateUser?.phone ? <Text className="text-sm text-muted">{affiliateUser.phone}</Text> : null}
              <Text className="text-sm text-muted">Code: {affiliate.referralCode}</Text>
              <Text className="text-sm text-muted">
                {ratePercent(affiliate.commissionRate)}
                {affiliate.commissionType ? ` · ${String(affiliate.commissionType).toLowerCase().replace(/_/g, " ")}` : ""}
                {affiliate.createdAt ? ` · joined ${formatDate(affiliate.createdAt)}` : ""}
              </Text>
            </Card>

            <View className="flex-row gap-3">
              <Card className="flex-1 gap-0.5">
                <Text className="text-xs text-muted">Clicks</Text>
                <Text className="text-lg font-jakarta-bold text-text">{data?.totalClicks ?? affiliate.totalClicks ?? 0}</Text>
              </Card>
              <Card className="flex-1 gap-0.5">
                <Text className="text-xs text-muted">Conversions</Text>
                <Text className="text-lg font-jakarta-bold text-text">{affiliate.totalConversions ?? 0}</Text>
              </Card>
              <Card className="flex-1 gap-0.5">
                <Text className="text-xs text-muted">Earnings</Text>
                <Text numberOfLines={1} className="text-lg font-jakarta-bold text-text">{formatPrice(affiliate.totalCommission ?? 0)}</Text>
              </Card>
            </View>

            {affiliate.applicationMessage ? (
              <Card className="gap-1">
                <Text className="font-jakarta-semibold text-text">Applicant&apos;s message</Text>
                <Text className="text-sm leading-5 text-muted">{affiliate.applicationMessage}</Text>
              </Card>
            ) : null}
            {affiliate.adminNote ? (
              <Card className="gap-1">
                <Text className="font-jakarta-semibold text-text">Admin note</Text>
                <Text className="text-sm leading-5 text-muted">{affiliate.adminNote}</Text>
              </Card>
            ) : null}

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

            {/* Commission history */}
            <Card className="gap-2.5">
              <Text className="font-jakarta-semibold text-text">Commission history</Text>
              {commissions.length === 0 ? (
                <Text className="text-sm text-muted">No commissions yet.</Text>
              ) : (
                commissions.map((c, i) => (
                  <Pressable
                    key={c.id}
                    disabled={!c.orderId}
                    onPress={() => c.orderId && router.push(`/admin/orders/${c.orderId}` as never)}
                    className={`flex-row items-center justify-between gap-3 pt-2 ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-jakarta-medium text-text">
                        {c.orderId ? `Order #${shortId(c.orderId)}` : `#${shortId(c.id)}`}
                      </Text>
                      <Text className="text-xs text-muted">
                        {formatDate(c.createdAt)}
                        {c.order?.total != null ? ` · order ${formatPrice(c.order.total)}` : ""}
                        {c.paidAt ? ` · paid ${formatDate(c.paidAt)}` : ""}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <Text className="text-sm font-jakarta-bold text-text">{formatPrice(c.amount)}</Text>
                      <StatusBadge value={c.status} map={COMMISSION_STATUS} />
                    </View>
                  </Pressable>
                ))
              )}
            </Card>
          </ScrollView>
        )}
      </AdminShell>
    </ScreenContainer>
  );
}
