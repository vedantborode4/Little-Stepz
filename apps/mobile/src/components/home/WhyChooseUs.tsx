import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Item = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  color: string;
};

// Mirrors apps/web/components/home/WhyChooseUs.tsx
const ITEMS: Item[] = [
  { icon: "cube-outline", label: "Free Shipping", desc: "On all orders", color: "#16A34A" },
  { icon: "refresh-outline", label: "Easy Returns", desc: "Hassle-free 7-day returns", color: "#2563EB" },
  { icon: "cash-outline", label: "Cash On Delivery", desc: "Pay when you receive", color: "#CA8A04" },
  { icon: "shield-checkmark-outline", label: "Secure Payments", desc: "100% safe & encrypted", color: "#9333EA" },
];

export function WhyChooseUs() {
  return (
    <View className="flex-row flex-wrap gap-3 px-4">
      {ITEMS.map((item) => (
        <View
          key={item.label}
          className="flex-1 basis-[45%] items-center rounded-2xl border border-border bg-surface p-4"
        >
          <View
            style={{ backgroundColor: item.color + "1F" }}
            className="mb-2 h-11 w-11 items-center justify-center rounded-xl"
          >
            <Ionicons name={item.icon} size={18} color={item.color} />
          </View>
          <Text className="text-center text-sm font-jakarta-semibold text-text">{item.label}</Text>
          <Text className="mt-0.5 text-center text-xs text-muted">{item.desc}</Text>
        </View>
      ))}
    </View>
  );
}
