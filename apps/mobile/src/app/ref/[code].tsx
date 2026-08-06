import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { api } from "../../lib/api/client";
import { colors } from "../../theme/tokens";

const AFFILIATE_KEY = "affiliate_id"; // must match checkout.service.ts

/**
 * Referral landing — /ref/[code] (reachable via deep link: mobile://ref/CODE).
 * Records the click, persists the affiliate id so it rides along as the
 * `X-Affiliate-Id` header at checkout, then bounces to home. Mirrors the web
 * `/ref/[code]` flow (apps/web/app/ref/[code]/page.tsx).
 */
export default function ReferralLanding() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    let done = false;
    (async () => {
      if (code) {
        // Remember the raw code so the signup form can prefill it.
        await AsyncStorage.setItem("pending_referral_code", code).catch(() => {});
        try {
          const res = await api.post("/affiliate/track-click", { referralCode: code });
          const affiliateId: string | undefined = res.data?.data?.affiliateId;
          if (affiliateId) await AsyncStorage.setItem(AFFILIATE_KEY, affiliateId);
        } catch {
          // Non-fatal — attribution may be skipped but the user still lands in-app.
        }
      }
      if (!done) router.replace("/(tabs)/home");
    })();
    return () => {
      done = true;
    };
  }, [code]);

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center gap-3">
        <ActivityIndicator color={colors.primary} />
        <Text className="text-sm text-muted">Just a moment…</Text>
      </View>
    </ScreenContainer>
  );
}
