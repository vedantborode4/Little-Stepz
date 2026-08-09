import { useRef, useState } from "react";
import { Dimensions, FlatList, Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { cldImage } from "../../lib/utils/image";
import { router } from "expo-router";
import { BannerService, type Banner } from "../../lib/services/banner.service";
import { resolveBannerTarget } from "../../lib/utils/bannerLink";
import { cardShadow } from "../../theme/shadows";

const { width } = Dimensions.get("window");
const CARD_W = width - 32;

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList>(null);

  if (!banners.length) return null;

  const onPress = (b: Banner) => {
    BannerService.trackClick(b.id);
    const target = resolveBannerTarget(b.linkUrl);
    if (!target) return;
    if (target.kind === "internal") router.push(target.href as any);
    else Linking.openURL(target.url).catch(() => {});
  };

  return (
    <View>
      <FlatList
        ref={ref}
        data={banners}
        keyExtractor={(b) => b.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16 }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (CARD_W + 12)))}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPress(item)}
            style={[{ width: CARD_W, marginRight: 12 }, cardShadow]}
            className="h-40 overflow-hidden rounded-lg bg-surface"
          >
            <Image source={{ uri: cldImage(item.imageUrl, { w: 900, crop: "limit" }) }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
          </Pressable>
        )}
      />
      {banners.length > 1 ? (
        <View className="mt-2 flex-row justify-center gap-1.5">
          {banners.map((b, i) => (
            <View
              key={b.id}
              className={i === index ? "h-1.5 w-4 rounded-full bg-primary" : "h-1.5 w-1.5 rounded-full bg-border"}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
