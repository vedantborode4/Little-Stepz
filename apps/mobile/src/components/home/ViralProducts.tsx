import { memo, useState } from "react";
import { Dimensions, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { SectionHeader } from "./SectionHeader";
import { Sheet } from "../ui/Sheet";
import { Price } from "../ui/Price";
import { qk } from "../../lib/api/query-client";
import { ViralReelService, type ViralReel } from "../../lib/services/viral-reel.service";
import { getDisplayPrices, getPriceRange } from "../../lib/pricing";
import { formatPrice } from "../../lib/utils/format";
import { cldImage } from "../../lib/utils/image";
import { cardShadow } from "../../theme/shadows";
import { useThemeColors } from "../../theme/useThemeColors";
import type { Product } from "../../types/product";

// Same sizing rule as ProductCarousel: a whole number of cards per screen (2 on phones).
const { width } = Dimensions.get("window");
const GAP = 16;
const TARGET = 172;
const COLS = Math.max(2, Math.floor((width - GAP) / (TARGET + GAP)));
const CARD_W = (width - (COLS + 1) * GAP) / COLS;

function ProductPrice({ product }: { product: Product }) {
  const variants = product.variants ?? [];
  const range = getPriceRange(product, variants);
  if (variants.length > 0 && !range.single) {
    return <Text className="text-sm font-jakarta-bold text-primary">From {formatPrice(range.min)}</Text>;
  }
  return <Price prices={getDisplayPrices(product)} className="text-sm text-primary" />;
}

function Thumb({ product, size }: { product: Product; size: number }) {
  const uri = cldImage(product.images?.[0]?.url, { w: size * 3, h: size * 3, crop: "fill" });
  return (
    <View className="overflow-hidden rounded-lg bg-surface-2" style={{ width: size, height: size }}>
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
    </View>
  );
}

function ReelCard({ reel, onOpen }: { reel: ViralReel; onOpen: () => void }) {
  const first = reel.products[0]!;
  const many = reel.products.length > 1;
  const cover = cldImage(reel.coverImageUrl, { w: 540, h: 960, crop: "fill" });

  return (
    <View className="overflow-hidden rounded-xl bg-surface" style={[{ width: CARD_W }, cardShadow]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Reel: ${reel.caption || first.name}. Watch or view product`}
        className="relative w-full bg-surface-2"
        style={{ aspectRatio: 9 / 16 }}
      >
        <Image
          source={{ uri: cover }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={reel.id}
        />
        <View className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/50">
          <Ionicons name="play" size={15} color="#fff" style={{ marginLeft: 2 }} />
        </View>
        {reel.caption ? (
          <View className="absolute inset-x-0 bottom-0 bg-black/55 px-2.5 py-2">
            <Text numberOfLines={2} className="text-xs font-jakarta-medium text-white">
              {reel.caption}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable
        onPress={many ? onOpen : () => router.push(`/product/${first.slug}`)}
        className="flex-row items-center gap-2 p-2.5"
      >
        <Thumb product={first} size={38} />
        <View className="flex-1">
          <Text numberOfLines={1} className="text-xs font-jakarta-medium text-text">
            {first.name}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <ProductPrice product={first} />
            {many ? <Text className="text-[10px] text-faint">+{reel.products.length - 1} more</Text> : null}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

function ReelSheet({ reel, visible, onClose }: { reel: ViralReel | null; visible: boolean; onClose: () => void }) {
  const colors = useThemeColors();
  const goTo = (slug: string) => {
    onClose();
    router.push(`/product/${slug}`);
  };
  const products = reel?.products ?? [];
  const single = products.length === 1 ? products[0] : null;

  return (
    <Sheet visible={visible} onClose={onClose} title={reel?.caption || "Viral reel"}>
      {reel ? (
        <View className="gap-3 pb-1">
          <Pressable
            onPress={() => Linking.openURL(reel.reelUrl).catch(() => {})}
            className="h-12 flex-row items-center justify-center gap-2 rounded-lg bg-primary"
          >
            <Ionicons name="logo-instagram" size={18} color="#fff" />
            <Text className="text-base font-jakarta-semibold text-white">Watch reel</Text>
          </Pressable>

          {single ? (
            <Pressable
              onPress={() => goTo(single.slug)}
              className="h-12 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-surface"
            >
              <Ionicons name="bag-handle-outline" size={18} color={colors.text} />
              <Text className="text-base font-jakarta-semibold text-text">View product</Text>
            </Pressable>
          ) : (
            <View>
              <Text className="mb-1 mt-1 text-sm font-jakarta-semibold text-muted">Products in this reel</Text>
              <ScrollView style={{ maxHeight: 340 }}>
                {products.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => goTo(p.slug)}
                    className="flex-row items-center gap-3 border-b border-border py-2.5"
                  >
                    <Thumb product={p} size={52} />
                    <View className="flex-1">
                      <Text numberOfLines={2} className="text-sm font-jakarta-medium text-text">
                        {p.name}
                      </Text>
                      <ProductPrice product={p} />
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      ) : null}
    </Sheet>
  );
}

function ViralProductsBase() {
  const { data: reels = [] } = useQuery({
    queryKey: qk.viralReels,
    queryFn: ViralReelService.getAll,
  });
  // The reel outlives `open` so the sheet keeps its content while sliding closed.
  const [active, setActive] = useState<ViralReel | null>(null);
  const [open, setOpen] = useState(false);

  if (!reels.length) return null; // self-hide until an admin adds a reel

  return (
    <View className="gap-5">
      <SectionHeader title="Viral Products" subtitle="As seen on our Instagram" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: GAP, gap: GAP, paddingTop: 4, paddingBottom: 14 }}
        snapToInterval={CARD_W + GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {reels.map((reel) => (
          <ReelCard key={reel.id} reel={reel} onOpen={() => { setActive(reel); setOpen(true); }} />
        ))}
      </ScrollView>
      <ReelSheet reel={active} visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

export const ViralProducts = memo(ViralProductsBase);
