import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AffiliateShell } from "../../features/affiliate/components/AffiliateShell";
import { ReferralLinkCard } from "../../features/affiliate/components/ReferralLinkCard";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { useAffiliateStats, useReferralLink } from "../../features/affiliate/hooks";
import { formatPrice } from "../../lib/utils/format";
import { colors } from "../../theme/tokens";

type QuickLink = {
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  tint: string;
};

const QUICK_LINKS: QuickLink[] = [
  { label: "View Clicks", desc: "See all unique visits from your link", icon: "finger-print-outline", route: "/affiliate/clicks", tint: "#2563EB" },
  { label: "View Commissions", desc: "Track your earned commissions", icon: "time-outline", route: "/affiliate/commissions", tint: "#16A34A" },
  { label: "Request Payout", desc: "Withdraw your pending balance", icon: "arrow-forward", route: "/affiliate/payout", tint: "#D97706" },
];

export default function AffiliateDashboard() {
  const stats = useAffiliateStats();
  const link = useReferralLink();

  const s: any = stats.data ?? {};
  const overview = s.overview ?? s;
  const recent = s.recent ?? {};
  const rate = overview.conversionRate ?? overview.commissionRate;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AffiliateShell active="dashboard">
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
          <View className="flex-row gap-3">
            <StatCard
              label="Total clicks"
              value={String(overview.totalClicks ?? 0)}
              icon="finger-print-outline"
              sub={recent.clicksLast7Days != null ? `${recent.clicksLast7Days} this week` : undefined}
            />
            <StatCard
              label="Conversions"
              value={String(overview.totalConversions ?? 0)}
              icon="trending-up-outline"
              tint="#16A34A"
              sub={rate != null ? `${typeof rate === "number" ? (rate * 100).toFixed(0) + "%" : rate} rate` : undefined}
            />
          </View>
          <View className="flex-row gap-3">
            <StatCard
              label="Total earnings"
              value={formatPrice(overview.totalEarnings ?? overview.totalCommission ?? 0)}
              icon="wallet-outline"
              tint="#2563EB"
            />
            <StatCard
              label="Pending"
              value={formatPrice(overview.pendingEarnings ?? overview.pendingBalance ?? 0)}
              icon="hourglass-outline"
              tint="#D97706"
              sub={overview.paidOutBalance != null ? `${formatPrice(overview.paidOutBalance)} paid out` : undefined}
            />
          </View>

          {/* GET /affiliate/referral-link returns `referralLink` and `referralCode`.
              These were read as `link` and `code`, so the card always rendered its
              empty-state dash and the affiliate had no link to share at all. */}
          <ReferralLinkCard link={link.data?.referralLink} code={link.data?.referralCode} />

          {/* Quick links */}
          <View className="gap-3">
            {QUICK_LINKS.map((q) => (
              <Pressable key={q.route} onPress={() => router.push(q.route as any)}>
                <Card className="flex-row items-center gap-3">
                  <View style={{ backgroundColor: q.tint + "20" }} className="h-10 w-10 items-center justify-center rounded-xl">
                    <Ionicons name={q.icon} size={18} color={q.tint} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-jakarta-semibold text-text">{q.label}</Text>
                    <Text className="text-xs text-muted">{q.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Card>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </AffiliateShell>
    </ScreenContainer>
  );
}
