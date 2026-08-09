import { ScrollView, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { NotificationService } from "../../lib/services/notification.service";
import { qk } from "../../lib/api/query-client";
import { useThemeColors } from "../../theme/useThemeColors";
import type { NotificationPreferences } from "../../types/notification";

type PrefKey = keyof NotificationPreferences;

const ROWS: {
  key: PrefKey;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "orderUpdates", label: "Order updates", hint: "Placed, shipped, delivered, cancelled", icon: "cube-outline" },
  { key: "paymentUpdates", label: "Payments & refunds", hint: "Payment success, failures and refunds", icon: "card-outline" },
  { key: "affiliateUpdates", label: "Affiliate", hint: "Commissions, payouts and referrals", icon: "people-outline" },
  { key: "marketing", label: "Offers & promotions", hint: "Sales, new drops and price drops", icon: "pricetag-outline" },
];

export default function NotificationPreferencesScreen() {
  const colors = useThemeColors();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: qk.notificationPrefs,
    queryFn: () => NotificationService.getPreferences(),
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      NotificationService.updatePreferences(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: qk.notificationPrefs });
      const prev = qc.getQueryData<NotificationPreferences>(qk.notificationPrefs);
      if (prev) qc.setQueryData(qk.notificationPrefs, { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.notificationPrefs, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notificationPrefs }),
  });

  const prefs = data;
  const pushOff = prefs ? !prefs.pushEnabled : false;

  const toggle = (key: PrefKey, value: boolean) => mutation.mutate({ [key]: value });

  return (
    <ScreenContainer>
      <Header title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {isLoading || !prefs ? (
          <Card className="gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </Card>
        ) : (
          <>
            <Card className="p-0">
              <View className="flex-row items-center gap-3 px-4 py-4">
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                <View className="flex-1">
                  <Text className="text-base font-jakarta-semibold text-text">Push notifications</Text>
                  <Text className="text-xs text-muted">
                    Turn off to stop all push alerts on this device
                  </Text>
                </View>
                <Switch
                  value={prefs.pushEnabled}
                  onValueChange={(v) => toggle("pushEnabled", v)}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            </Card>

            <View className="gap-2">
              <Text className="px-1 text-xs font-jakarta-semibold uppercase tracking-wide text-muted">
                Categories
              </Text>
              <Card className="p-0">
                {ROWS.map((r, i) => (
                  <View
                    key={r.key}
                    className={`flex-row items-center gap-3 px-4 py-4 ${
                      i < ROWS.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <Ionicons name={r.icon} size={20} color={pushOff ? colors.muted : colors.text} />
                    <View className="flex-1">
                      <Text className={`text-base ${pushOff ? "text-muted" : "text-text"}`}>{r.label}</Text>
                      <Text className="text-xs text-muted">{r.hint}</Text>
                    </View>
                    <Switch
                      value={prefs[r.key]}
                      disabled={pushOff}
                      onValueChange={(v) => toggle(r.key, v)}
                      trackColor={{ true: colors.primary }}
                    />
                  </View>
                ))}
              </Card>
              <Text className="px-1 text-xs text-muted">
                Order and payment alerts still appear in your in-app feed even when their push is off.
                Turning off a category only silences the push.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
