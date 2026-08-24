import { useState } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, Text, UIManager, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { colors } from "../../theme/tokens";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "Are the products genuine and authentic?",
    a: "Yes. Every product is sourced from verified global suppliers and passes a quality check before it reaches you. We deal only in authentic products — never counterfeits.",
  },
  {
    q: "How long does delivery take?",
    a: "Orders are usually dispatched within 48 hours and delivered across 500+ cities pan-India. Delivery timelines depend on your location and are shown at checkout.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept UPI, Visa, Mastercard and RuPay cards, net banking and wallets, all handled securely through Razorpay. Every order is paid for at checkout.",
  },
  {
    q: "Can I cancel or return my order?",
    a: "Orders can be cancelled while they are still Pending or Confirmed. Eligible items can be returned within our 7-day return window — see our Returns & Refund policy for details.",
  },
  {
    q: "How do I track my order?",
    a: "Open My Orders from your account to see live status, and use Track Shipment on any order for real-time courier updates.",
  },
  {
    q: "How do pre-orders work?",
    a: "For pre-order items you pay a small booking amount to reserve the product. We notify you to pay the balance once stock arrives, after which your order ships.",
  },
  {
    q: "Do you offer Cash on Delivery?",
    a: "No. Cash on Delivery is no longer offered — orders are paid for securely at checkout by UPI, card, net banking or wallet.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-surface">
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((o) => !o);
        }}
        className="flex-row items-center gap-3 px-4 py-3.5"
      >
        <Text className="flex-1 text-sm font-jakarta-semibold text-text">{q}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <View className="px-4 pb-4">
          <Text className="text-sm leading-relaxed text-muted">{a}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function Faq() {
  return (
    <ScreenContainer bgClassName="bg-surface">
      <Header title="FAQ" className="bg-surface" />
      <ScrollView className="bg-surface" contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}>
        <Text className="mb-1 text-sm leading-relaxed text-muted">
          Answers to the questions we hear most. Still need help? Reach out and our team will be glad to assist.
        </Text>
        {FAQS.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}
