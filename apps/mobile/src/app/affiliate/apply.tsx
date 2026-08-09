import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAffiliateMe } from "../../features/affiliate/hooks";
import { AffiliateService } from "../../features/affiliate/services/affiliate.service";
import { qk } from "../../lib/api/query-client";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

const BENEFITS = [
  { icon: "cash-outline", title: "Earn commissions", text: "Get paid for every sale you refer." },
  { icon: "link-outline", title: "Share your link", text: "Promote on WhatsApp, social media & more." },
  { icon: "stats-chart-outline", title: "Track everything", text: "See clicks, conversions & earnings live." },
] as const;

export default function AffiliateApply() {
  const me = useAffiliateMe();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const status = me.data?.status as string | undefined;

  // Already approved → go to dashboard.
  useEffect(() => {
    if (status === "APPROVED") router.replace("/affiliate");
  }, [status]);

  const onApply = async () => {
    setSubmitting(true);
    try {
      await AffiliateService.apply({ message });
      toast.success("Application submitted");
      qc.invalidateQueries({ queryKey: qk.affiliateMe });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="Become an Affiliate" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {status === "PENDING" ? (
          <Card className="flex-row items-center gap-2 border border-warning/40">
            <Ionicons name="time-outline" size={22} color={colors.warning} />
            <Text className="flex-1 text-sm text-text">Your application is under review. We&apos;ll notify you once it&apos;s approved.</Text>
          </Card>
        ) : null}
        {status === "REJECTED" ? (
          <Card className="flex-row items-center gap-2 border border-danger/40">
            <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
            <Text className="flex-1 text-sm text-text">
              Your previous application was not approved.{me.data?.adminNote ? ` Note: ${me.data.adminNote}` : ""}
            </Text>
          </Card>
        ) : null}

        <Text className="text-2xl font-jakarta-bold text-text">Grow with Little Stepz</Text>
        <Text className="text-muted">Join our affiliate program and earn on every referral.</Text>

        {BENEFITS.map((b) => (
          <Card key={b.title} className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Ionicons name={b.icon} size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="font-jakarta-semibold text-text">{b.title}</Text>
              <Text className="text-sm text-muted">{b.text}</Text>
            </View>
          </Card>
        ))}

        {status !== "PENDING" ? (
          <>
            <Text className="mt-2 font-jakarta-medium text-text">Why do you want to join? (optional)</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder="Tell us about your audience…"
              placeholderTextColor={colors.muted}
              className="min-h-20 rounded-lg border border-border bg-surface p-3 text-text"
              textAlignVertical="top"
            />
            <Button label="Submit Application" loading={submitting} onPress={onApply} />
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
