import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/tokens";

const FEATURES = [
  { label: "Safe & Tested", desc: "All toys are child-safe certified" },
  { label: "Age Appropriate", desc: "Designed for each growth stage" },
  { label: "Skill Building", desc: "Supports cognitive development" },
  { label: "Joyful Play", desc: "Fun that sparks imagination" },
];

export function OurPromise() {
  return (
    <View className="mx-4 overflow-hidden rounded-xl border border-border bg-surface">
      {/* Top — accent block */}
      <View className="gap-4 border-b border-border bg-primary/5 px-6 py-8">
        <View className="flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Ionicons name="sparkles" size={13} color={colors.primary} />
          </View>
          <Text className="text-xs font-jakarta-semibold uppercase tracking-wider text-primary">
            Our Promise
          </Text>
        </View>

        <View>
          <Text className="text-3xl font-jakarta-bold leading-tight text-primary">
            Made for Little Hands
          </Text>
          <Text className="text-3xl font-jakarta-bold leading-tight text-text">
            Made for Big Fun
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.push("/search")}
            className="flex-row items-center gap-2 self-start rounded-xl bg-primary px-5 py-2.5"
          >
            <Text className="text-sm font-jakarta-semibold text-white">Shop Now</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </Pressable>
          <Pressable onPress={() => router.push("/legal/about")} className="flex-row items-center gap-1 self-start py-2.5">
            <Text className="text-sm font-jakarta-semibold text-primary">Read Our Story</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Bottom — description + trust badges */}
      <View className="gap-5 px-6 py-8">
        <Text className="text-sm leading-relaxed text-muted">
          Little Stepz creates safe, fun, and thoughtfully designed toys that help children learn
          through play. Every product supports early development, creativity, and joyful milestones —
          because every big journey begins with little steps.
        </Text>

        <View className="flex-row flex-wrap gap-3">
          {FEATURES.map((f) => (
            <View
              key={f.label}
              className="flex-1 basis-[45%] rounded-xl border border-border bg-bg p-3"
            >
              <Text className="text-xs font-jakarta-semibold text-text">{f.label}</Text>
              <Text className="mt-0.5 text-xs text-muted">{f.desc}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
