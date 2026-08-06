import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/tokens";

const ADVANTAGES: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }[] = [
  { icon: "airplane-outline", title: "Directly Imported", subtitle: "Sourced straight from makers" },
  { icon: "ribbon-outline", title: "Premium Quality", subtitle: "Safe, tested & durable" },
  { icon: "map-outline", title: "Pan-India Delivery", subtitle: "We ship everywhere" },
  { icon: "pricetags-outline", title: "Wholesale & Retail", subtitle: "Great prices at any scale" },
  { icon: "grid-outline", title: "12 Toys Categories", subtitle: "Something for everyone" },
  { icon: "headset-outline", title: "Dedicated Support", subtitle: "We're here to help" },
];

/** Light red band — mirrors the web `bg-bg` section (not a solid primary block). */
export function WhyChooseLittleStepz() {
  return (
    <View className="gap-5 bg-bg px-4 py-10">
      <View className="items-center gap-1">
        <Text className="text-xs font-jakarta-semibold uppercase tracking-widest text-primary">Our Advantage</Text>
        <Text className="text-center text-3xl font-anton uppercase tracking-wide text-text">
          Why Choose Little Stepz
        </Text>
        <Text className="mt-1 text-center text-sm leading-relaxed text-muted">
          {"We're not just a reseller — we're a direct importer committed to quality, authenticity and service."}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {ADVANTAGES.map((a) => (
          <View key={a.title} className="flex-1 basis-[45%] gap-1.5 rounded-2xl border border-border bg-surface p-3.5">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Ionicons name={a.icon} size={18} color={colors.primary} />
            </View>
            <Text className="text-sm font-jakarta-semibold text-text">{a.title}</Text>
            <Text className="text-[11px] leading-snug text-muted">{a.subtitle}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
