import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  BUSINESS_ADDRESS,
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164,
  SUPPORT_RESPONSE_TIME,
  SUPPORT_WHATSAPP_URL,
} from "@repo/content/index";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Card } from "../../components/ui/Card";
import { TAWK_CHAT_URL } from "../../lib/env";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

type IconName = keyof typeof Ionicons.glyphMap;

interface Channel {
  icon: IconName;
  label: string;
  value: string;
  note: string;
  onPress: () => void;
}

/** Opens a mailto:/tel:/https: URL, telling the user what to do when nothing can handle it. */
async function openExternal(url: string, fallback: string) {
  try {
    await Linking.openURL(url);
  } catch {
    toast.error(fallback);
  }
}

const SELF_SERVE: { label: string; icon: IconName; href?: string; url?: string }[] = [
  { label: "Track or manage an order", icon: "receipt-outline", href: "/orders" },
  { label: "Shipping & delivery timelines", icon: "cube-outline", href: "/legal/shipping" },
  { label: "Returns & refunds", icon: "return-down-back-outline", href: "/legal/returns" },
  { label: "Cancel an order", icon: "close-circle-outline", href: "/legal/cancellation" },
  { label: "Warranty & safety", icon: "shield-checkmark-outline", href: "/legal/warranty" },
  { label: "Unboxing video requirement", icon: "videocam-outline", href: "/legal/authenticity" },
  { label: "Frequently asked questions", icon: "help-circle-outline", href: "/legal/faq" },
  { label: "Delete your account or data", icon: "trash-outline", url: "https://littlestepz.in/data-deletion" },
];

/**
 * Support & Contact — every way to reach us, mirroring the website's /support page.
 * Live chat (tawk.to) is one channel among several rather than the whole screen, so a
 * customer can still call, WhatsApp or email when chat is unconfigured or they prefer it.
 */
export default function Support() {
  const channels: Channel[] = [
    ...(TAWK_CHAT_URL
      ? [
          {
            icon: "chatbubbles-outline" as IconName,
            label: "Live chat",
            value: "Chat with our team",
            note: "Quick questions about an order or a product.",
            onPress: () => router.push("/support/chat" as never),
          },
        ]
      : []),
    {
      icon: "logo-whatsapp",
      label: "WhatsApp",
      value: SUPPORT_PHONE_DISPLAY,
      note: "Message us about an existing order.",
      onPress: () => openExternal(SUPPORT_WHATSAPP_URL, `WhatsApp isn't available. Message us on ${SUPPORT_PHONE_DISPLAY}.`),
    },
    {
      icon: "call-outline",
      label: "Call us",
      value: SUPPORT_PHONE_DISPLAY,
      note: SUPPORT_HOURS,
      onPress: () => openExternal(`tel:${SUPPORT_PHONE_E164}`, `Couldn't start a call. Our number is ${SUPPORT_PHONE_DISPLAY}.`),
    },
    {
      icon: "mail-outline",
      label: "Email us",
      value: SUPPORT_EMAIL,
      note: "Best for returns and warranty claims — include your order ID.",
      onPress: () => openExternal(`mailto:${SUPPORT_EMAIL}`, `No email app found. Write to us at ${SUPPORT_EMAIL}.`),
    },
  ];

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <Header title="Help & Support" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Text className="text-sm leading-5 text-muted">
          Need help with an order, a delivery, a return or a product? Reach us on any of the
          channels below — {SUPPORT_RESPONSE_TIME}
        </Text>

        {/* Contact channels */}
        <View className="gap-2.5">
          <Text className="font-jakarta-semibold text-text">Contact us</Text>
          {channels.map((c) => (
            <Card key={c.label} elevated={false} clip className="p-0">
              <Pressable
                onPress={c.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${c.label}: ${c.value}`}
                className="flex-row items-center gap-3 px-4 py-3.5"
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Ionicons name={c.icon} size={20} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-jakarta-semibold uppercase tracking-wide text-primary">{c.label}</Text>
                  <Text className="text-sm font-jakarta-semibold text-text">{c.value}</Text>
                  <Text className="text-xs text-muted">{c.note}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            </Card>
          ))}
        </View>

        {/* Hours */}
        <Card elevated={false} className="gap-1.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text className="font-jakarta-semibold text-text">Support hours</Text>
          </View>
          <Text className="text-sm leading-5 text-muted">
            {SUPPORT_HOURS}. Messages received outside these hours are answered on the next
            working day.
          </Text>
        </Card>

        {/* What to include */}
        <Card elevated={false} className="gap-1.5">
          <Text className="font-jakarta-semibold text-text">What to include</Text>
          {[
            "Your order ID, and the email or phone number on your account.",
            "For a damaged or wrong item, the unedited unboxing video.",
            "Photos of the product and the outer packaging, where relevant.",
          ].map((line) => (
            <View key={line} className="flex-row gap-2">
              <Text className="text-sm text-muted">•</Text>
              <Text className="flex-1 text-sm leading-5 text-muted">{line}</Text>
            </View>
          ))}
        </Card>

        {/* Self-serve */}
        <View className="gap-2.5">
          <Text className="font-jakarta-semibold text-text">Find an answer faster</Text>
          <Card elevated={false} clip className="p-0">
            {SELF_SERVE.map((item, i) => (
              <Pressable
                key={item.label}
                onPress={() =>
                  item.href
                    ? router.push(item.href as never)
                    : openExternal(item.url!, "Couldn't open the page. Please try again.")
                }
                accessibilityRole="link"
                className={`flex-row items-center gap-3 px-4 py-3.5 ${i < SELF_SERVE.length - 1 ? "border-b border-border" : ""}`}
              >
                <Ionicons name={item.icon} size={18} color={colors.muted} />
                <Text className="flex-1 text-sm text-text">{item.label}</Text>
                <Ionicons name={item.url ? "open-outline" : "chevron-forward"} size={16} color={colors.muted} />
              </Pressable>
            ))}
          </Card>
        </View>

        {/* Address */}
        <Card elevated={false} className="gap-1.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="location-outline" size={16} color={colors.primary} />
            <Text className="font-jakarta-semibold text-text">Registered business address</Text>
          </View>
          <Text className="text-sm leading-5 text-muted">Little Stepz{"\n"}{BUSINESS_ADDRESS}</Text>
          <Text className="text-xs leading-4 text-faint">
            Please don&apos;t send returns to this address without a confirmed return authorisation
            from our support team.
          </Text>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}
