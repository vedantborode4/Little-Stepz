import { Text, View } from "react-native";

// Mirrors apps/web/components/home/AboutUs.tsx
const FEATURES = [
  {
    emoji: "🏎️",
    title: "RC Cars & Diecast",
    desc: "Officially licensed RC cars — Ferrari, Bugatti, Mercedes, Lamborghini. Premium 1:12 scale diecast hypercar models sourced directly from global manufacturers.",
  },
  {
    emoji: "🚚",
    title: "Pan-India Delivery",
    desc: "Shipping to 500+ cities across India. Direct importer, wholesaler and retailer — no middlemen, 100% authentic products at your doorstep.",
  },
  {
    emoji: "🏆",
    title: "Collectibles",
    desc: "Rare limited-edition figures, licensed Stanley tumblers, hobby-grade rock crawlers and exclusive imports — curated for collectors and enthusiasts.",
  },
  {
    emoji: "🛡️",
    title: "100% Authentic",
    desc: "Every product is directly sourced and verified. Unboxing proof, genuine warranties, and transparent policies — authenticity is our commitment.",
  },
];

const TAGS = ["Direct Importer", "Wholesaler", "Retailer", "Pan-India"];

/** Light red band — mirrors the web "About Us" section. */
export function AboutUs() {
  return (
    <View className="gap-6 bg-bg px-4 py-10">
      {/* Intro */}
      <View>
        <Text className="text-xs font-jakarta-bold uppercase tracking-widest text-primary">
          About Little Stepz
        </Text>
        <Text className="mt-2 text-3xl font-anton uppercase leading-tight text-text">
          India&apos;s Premier RC & <Text className="text-primary">Diecast Destination</Text>
        </Text>

        <View className="mt-4 gap-3">
          <Text className="text-sm leading-relaxed text-muted">
            Born in 2025 from a deep passion for RC cars, diecast collectibles, and racing culture,
            Little Stepz was created to bring India its finest selection of premium hobby-grade
            vehicles and rare collectibles.
          </Text>
          <Text className="text-sm leading-relaxed text-muted">
            As a direct importer, wholesaler, and retailer, we source officially licensed RC cars —
            Ferrari, Bugatti, Mercedes-Benz, Lamborghini, McLaren — alongside premium 1:12 scale
            diecast models, rock crawlers, and limited-edition collectibles.
          </Text>
          <Text className="text-sm leading-relaxed text-muted">
            Every product is 100% authentic, warranty-backed, and shipped across 500+ cities in
            India. From hobbyists to collectors, Little Stepz is your trusted partner for premium
            automotive toys and collectibles.
          </Text>
        </View>

        {/* Tags */}
        <View className="mt-5 flex-row flex-wrap gap-2.5">
          {TAGS.map((t) => (
            <View key={t} className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5">
              <Text className="text-xs font-jakarta-semibold text-primary">{t}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Feature cards */}
      <View className="flex-row flex-wrap gap-3">
        {FEATURES.map((f) => (
          <View key={f.title} className="flex-1 basis-[45%] rounded-2xl border border-border bg-surface p-4">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Text className="text-2xl">{f.emoji}</Text>
            </View>
            <Text className="mt-3 text-sm font-jakarta-bold text-text">{f.title}</Text>
            <Text className="mt-1.5 text-xs leading-relaxed text-muted">{f.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
