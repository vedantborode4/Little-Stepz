import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Header } from "../../../components/layout/Header";
import { useAffiliateMe } from "../hooks";
import { useBottomInset } from "../../../hooks/useBottomInset";
import { colors } from "../../../theme/tokens";

type Tab = { key: string; label: string; route: string };

const TABS: Tab[] = [
  { key: "dashboard", label: "Dashboard", route: "/affiliate" },
  { key: "conversions", label: "Conversions", route: "/affiliate/conversions" },
  { key: "commissions", label: "Commissions", route: "/affiliate/commissions" },
  { key: "orders", label: "Orders", route: "/affiliate/orders" },
  { key: "clicks", label: "Clicks", route: "/affiliate/clicks" },
  { key: "payout", label: "Payout", route: "/affiliate/payout" },
];

export function AffiliateShell({ active, children }: { active: string; children: React.ReactNode }) {
  const me = useAffiliateMe();
  // Called before the early returns below so hook order stays stable.
  const bottomInset = useBottomInset();

  if (me.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  // Gate: only approved affiliates see the panel; others go to the application screen.
  if (me.isError || me.data?.status !== "APPROVED") {
    return <Redirect href="/affiliate/apply" />;
  }

  return (
    <View className="flex-1 bg-bg">
      <Header title="Affiliate" onBack={() => router.replace("/(tabs)/account")} />
      <View className="border-b border-border bg-bg">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingVertical: 8 }}>
          {TABS.map((t) => {
            const on = t.key === active;
            return (
              <Pressable
                key={t.key}
                onPress={() => !on && router.replace(t.route as any)}
                className={`rounded-full px-3 py-1.5 ${on ? "bg-primary" : "border border-border bg-surface"}`}
              >
                <Text className={on ? "text-sm font-jakarta-semibold text-white" : "text-sm text-text"}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View className="flex-1" style={{ paddingBottom: bottomInset }}>
        {children}
      </View>
    </View>
  );
}
