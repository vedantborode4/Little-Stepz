import { useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { PagedList } from "../../../components/ui/PagedList";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Sheet } from "../../../components/ui/Sheet";
import { StatCard } from "../../../components/ui/StatCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SelectSheet } from "../../../components/ui/SelectSheet";
import { AdminAffiliateService, type AdminAffiliate } from "../../../features/admin/services/admin.services";
import { AFFILIATE_STATUS } from "../../../lib/enums";
import { formatPrice } from "../../../lib/utils/format";
import { getErrorMessage } from "../../../lib/utils/errors";
import { toast } from "../../../store/toast.store";
import { colors } from "../../../theme/tokens";

/** Where an invitee applies. The emailed invite links to the same page. */
const APPLY_URL = "https://littlestepz.in/affiliate/apply";

export default function AdminAffiliates() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

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

  const sendInvite = async () => {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSending(true);
    try {
      const res = await AdminAffiliateService.invite(value);
      toast.success(res.emailSent ? "Invite email sent" : "Invite created — email is unavailable, share the link instead");
      setEmail("");
    } catch (e) {
      toast.error(getErrorMessage(e, "Failed to send invite"));
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(APPLY_URL);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell
        active="affiliates"
        title="Affiliates"
        right={
          <Pressable onPress={() => setInviteOpen(true)} hitSlop={8} accessibilityLabel="Invite affiliate">
            <Ionicons name="person-add-outline" size={23} color={colors.primary} />
          </Pressable>
        }
      >
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

      <Sheet visible={inviteOpen} onClose={() => (sending ? null : setInviteOpen(false))} title="Invite affiliate">
        <View className="gap-3">
          <Text className="text-sm text-muted">
            Email someone an invite to apply for the affiliate program, or share the link yourself.
          </Text>
          <Input
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="person@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={sendInvite}
          />
          <Button label="Send Invite Email" loading={sending} onPress={sendInvite} left={<Ionicons name="mail-outline" size={16} color="#fff" />} />
          <View className="flex-row items-center gap-3">
            <View className="h-px flex-1 bg-border" />
            <Text className="text-xs text-faint">or share the link</Text>
            <View className="h-px flex-1 bg-border" />
          </View>
          <View className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
            <Text numberOfLines={1} className="text-sm text-muted">{APPLY_URL}</Text>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="Copy" variant="outline" onPress={copyLink} left={<Ionicons name="copy-outline" size={16} color={colors.primary} />} />
            </View>
            <View className="flex-1">
              <Button
                label="Share"
                variant="outline"
                onPress={() => Share.share({ message: `Join the Little Stepz affiliate program: ${APPLY_URL}` }).catch(() => {})}
                left={<Ionicons name="share-social-outline" size={16} color={colors.primary} />}
              />
            </View>
          </View>
        </View>
      </Sheet>
    </ScreenContainer>
  );
}
