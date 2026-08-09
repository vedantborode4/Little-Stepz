import { Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { BannerService, type Banner } from "../../lib/services/banner.service";
import { resolveBannerTarget } from "../../lib/utils/bannerLink";

function openBanner(b: Banner) {
  BannerService.trackClick(b.id);
  const target = resolveBannerTarget(b.linkUrl);
  if (!target) return;
  if (target.kind === "internal") router.push(target.href as any);
  else Linking.openURL(target.url).catch(() => {});
}

/** Renders active banners for a given position (e.g. CATEGORY_TOP, CHECKOUT_TOP). Self-hides when empty. */
export function PromoSlot({ position, height = 140 }: { position: string; height?: number }) {
  const { data: banners = [] } = useQuery({
    queryKey: ["banners", position],
    queryFn: () => BannerService.getByPosition(position),
  });

  if (!banners.length) return null;

  return (
    <View className="gap-3 px-4">
      {banners.map((b) => (
        <Pressable
          key={b.id}
          onPress={() => openBanner(b)}
          disabled={!b.linkUrl}
          style={{ height }}
          className="w-full overflow-hidden rounded-xl bg-surface"
        >
          <Image source={{ uri: b.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
        </Pressable>
      ))}
    </View>
  );
}
