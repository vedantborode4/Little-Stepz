import { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Linking, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { cldImage } from "../../lib/utils/image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { BannerService, type Banner } from "../../lib/services/banner.service";
import { resolveBannerTarget } from "../../lib/utils/bannerLink";
import { colors } from "../../theme/tokens";

const { width, height } = Dimensions.get("window");
const HERO_H = Math.round(height * 0.44); // tall mobile hero (~44% of the screen)

// The whole banner is tappable. Anything pointing at our own site stays in the app;
// only genuinely third-party links open the browser.
function openBanner(b: Banner) {
  BannerService.trackClick(b.id);
  const target = resolveBannerTarget(b.linkUrl);
  if (!target) return;
  if (target.kind === "internal") router.push(target.href as any);
  else Linking.openURL(target.url).catch(() => {});
}

const STATS = [
  { value: "500+", label: "Cities" },
  { value: "22+", label: "Products" },
  { value: "100%", label: "Authentic" },
  { value: "48h", label: "Dispatch" },
];

/** Shown when no HOME_HERO banner is configured — mirrors the web HeroFallback. */
function HeroFallback() {
  return (
    <View className="w-full overflow-hidden bg-bg px-5 py-8">
      <View className="items-center">
        {/* Badge */}
        <View className="flex-row items-center gap-2 rounded-full border border-primary/30 bg-surface/70 px-4 py-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-primary" />
          <Text className="text-[11px] font-jakarta-semibold uppercase tracking-wider text-primary">
            Now Shipping Pan-India · 500+ Cities
          </Text>
        </View>

        {/* Heading — Anton */}
        <Text className="mt-5 text-center text-4xl font-anton uppercase leading-tight text-text">
          India&apos;s #1 Store for <Text className="text-primary">RC Cars</Text> & Collectibles
        </Text>

        {/* Subtitle */}
        <Text className="mt-4 max-w-md text-center text-sm leading-relaxed text-muted">
          Directly imported premium RC cars, diecast models and collectibles — delivered anywhere in India.
        </Text>

        {/* CTAs */}
        <View className="mt-6 flex-row flex-wrap items-center justify-center gap-3">
          <Pressable
            onPress={() => router.push("/(tabs)/search")}
            className="flex-row items-center gap-2 rounded-full bg-primary px-7 py-3"
          >
            <Text className="text-sm font-jakarta-semibold uppercase text-white">Shop Now</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/preorders")}
            className="rounded-full border border-border bg-surface px-7 py-3"
          >
            <Text className="text-sm font-jakarta-semibold text-text">Pre-Order</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View className="mt-8 w-full max-w-sm flex-row flex-wrap justify-center gap-x-8 gap-y-5">
          {STATS.map((s) => (
            <View key={s.label} className="items-center" style={{ width: "40%" }}>
              <Text className="text-2xl font-jakarta-bold leading-none text-text">{s.value}</Text>
              <Text className="mt-1 text-[10px] font-jakarta-medium uppercase tracking-wider text-muted">{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function HeroBanner() {
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["banners", "MOBILE_HERO"],
    queryFn: async () => {
      // Prefer the dedicated mobile banner; fall back to the desktop HOME_HERO
      // banners so the hero still shows real content until MOBILE_HERO is set up.
      const mobile = await BannerService.getByPosition("MOBILE_HERO");
      if (mobile.length) return mobile;
      return BannerService.getByPosition("HOME_HERO");
    },
  });

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const paused = useRef(false);
  const ref = useRef<FlatList<Banner>>(null);

  // Gentle auto-rotate (6s) that pauses while the user is interacting, so a
  // banner never slides away under their finger (client 4.1).
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      if (paused.current) return;
      const nextIdx = (indexRef.current + 1) % banners.length;
      indexRef.current = nextIdx;
      setIndex(nextIdx);
      ref.current?.scrollToOffset({ offset: nextIdx * width, animated: true });
    }, 6000);
    return () => clearInterval(t);
  }, [banners.length]);

  const goTo = (i: number) => {
    const next = (i + banners.length) % banners.length;
    indexRef.current = next;
    setIndex(next);
    ref.current?.scrollToOffset({ offset: next * width, animated: true });
  };

  // Loading — pulse placeholder at the hero aspect ratio.
  if (isLoading) {
    return <View style={{ width, height: HERO_H }} className="bg-surface-2" />;
  }

  // Conditional rendering: no banners → rich fallback (like web).
  if (!banners.length) return <HeroFallback />;

  return (
    <View>
      <FlatList
        ref={ref}
        data={banners}
        keyExtractor={(b) => b.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScrollBeginDrag={() => {
          paused.current = true;
        }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          indexRef.current = i;
          setIndex(i);
          // Resume auto-rotate a few seconds after the user stops swiping.
          setTimeout(() => {
            paused.current = false;
          }, 4000);
        }}
        renderItem={({ item }) => (
          <Pressable onPress={() => openBanner(item)} style={{ width, height: HERO_H }}>
            <Image source={{ uri: cldImage(item.imageUrl, { w: 1000, crop: "limit" }) }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} cachePolicy="memory-disk" />
            {/* Text overlay only — no dark tint over the banner image */}
            <View className="absolute inset-0 justify-center px-5">
              {item.title ? (
                <Text
                  numberOfLines={2}
                  style={{ textShadowColor: "rgba(0,0,0,0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 }}
                  className="max-w-[240px] text-2xl font-anton uppercase leading-tight text-white"
                >
                  {item.title}
                </Text>
              ) : null}
              {item.subtitle ? (
                <Text
                  numberOfLines={2}
                  style={{ textShadowColor: "rgba(0,0,0,0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
                  className="mt-1 max-w-[220px] text-xs text-white"
                >
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      {banners.length > 1 ? (
        <>
          <Pressable
            onPress={() => goTo(index - 1)}
            hitSlop={6}
            style={{ top: HERO_H / 2 - 16 }}
            className="absolute left-2 h-8 w-8 items-center justify-center rounded-full bg-white/85"
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => goTo(index + 1)}
            hitSlop={6}
            style={{ top: HERO_H / 2 - 16 }}
            className="absolute right-2 h-8 w-8 items-center justify-center rounded-full bg-white/85"
          >
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
          <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
            {banners.map((b, i) => (
              <View
                key={b.id}
                className={i === index ? "h-1.5 w-5 rounded-full bg-white" : "h-1.5 w-1.5 rounded-full bg-white/50"}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
