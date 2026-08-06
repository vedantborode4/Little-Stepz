import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { colors } from "../../theme/tokens";

const POINTS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: "shield-checkmark-outline",
    title: "100% Authentic",
    body: "Every product is imported from verified global suppliers and quality-checked before dispatch. We never sell counterfeits or replicas.",
  },
  {
    icon: "cube-outline",
    title: "Unboxing Proof",
    body: "High-value orders are recorded during packing, so what you order is exactly what leaves our warehouse — sealed and intact.",
  },
  {
    icon: "ribbon-outline",
    title: "Genuine Warranty",
    body: "Applicable products carry the manufacturer's genuine warranty. Keep your invoice, available anytime under My Orders.",
  },
  {
    icon: "refresh-outline",
    title: "Easy Returns",
    body: "If a product arrives damaged or not as described, our 7-day return policy has you covered — see Returns & Refund for details.",
  },
];

export default function Authenticity() {
  return (
    <ScreenContainer bgClassName="bg-surface">
      <Header title="Authenticity & Unboxing" className="bg-surface" />
      <ScrollView className="bg-surface" contentContainerStyle={{ padding: 16, gap: 14, flexGrow: 1 }}>
        <Text className="text-sm leading-relaxed text-muted">
          Authenticity is at the heart of Little Stepz. Here&apos;s how we make sure every order you receive is the
          real thing — safely packed and exactly as promised.
        </Text>

        {POINTS.map((p) => (
          <View key={p.title} className="flex-row gap-3 rounded-xl border border-border bg-surface p-4">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Ionicons name={p.icon} size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-jakarta-semibold text-text">{p.title}</Text>
              <Text className="mt-1 text-sm leading-relaxed text-muted">{p.body}</Text>
            </View>
          </View>
        ))}

        <Text className="mt-1 text-xs leading-relaxed text-faint">
          Have a concern about a product&apos;s authenticity? Contact our support team with your order ID and we&apos;ll
          make it right.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}
