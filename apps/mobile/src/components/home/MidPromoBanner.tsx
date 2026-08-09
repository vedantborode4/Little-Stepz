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

export function MidPromoBanner() {
  const { data: banners = [] } = useQuery({
    queryKey: ["banners", "HOME_MID"],
    queryFn: () => BannerService.getByPosition("HOME_MID"),
  });

  if (!banners.length) return null;

  return (
    <View className="gap-4 px-4">
      {banners.map((b) => (
        <Pressable
          key={b.id}
          onPress={() => openBanner(b)}
          disabled={!b.linkUrl}
          className="h-[180px] w-full overflow-hidden rounded-xl bg-surface"
        >
          <Image
            source={{ uri: b.imageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        </Pressable>
      ))}
    </View>
  );
}
