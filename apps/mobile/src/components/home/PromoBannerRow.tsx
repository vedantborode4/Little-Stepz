import { useEffect, useRef } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { CategoryService } from "../../lib/services/category.service";
import { qk } from "../../lib/api/query-client";

// Sized so a whole number of tiles fit the viewport — no half tile at the edge.
const { width } = Dimensions.get("window");
const GAP = 16;
const TARGET = 112;
const COLS = Math.max(2, Math.floor((width - GAP) / (TARGET + GAP)));
const TILE_W = (width - (COLS + 1) * GAP) / COLS;
const STEP = TILE_W + GAP;

const AUTO_MS = 3500;
const RESUME_MS = 4000;

function Tile({ title, slug, source }: { title: string; slug: string; source?: any }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/category/[slug]", params: { slug } })}
      style={{ width: TILE_W }}
      className="h-[120px] overflow-hidden rounded-xl"
    >
      {source ? (
        <>
          <Image source={source} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          <View className="absolute inset-0 bg-black/30" />
          <Text className="absolute bottom-2 left-2 max-w-[90%] text-xs font-jakarta-semibold leading-tight text-white">
            {title}
          </Text>
        </>
      ) : (
        // Category without an image yet — styled placeholder, still a real category.
        <View className="h-full w-full items-center justify-center bg-primary/10 p-3">
          <Text className="text-center text-xs font-jakarta-semibold leading-tight text-primary">{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function PromoBannerRow() {
  const { data } = useQuery({ queryKey: qk.categories, queryFn: () => CategoryService.getAll() });

  // Show every top-level category (image or not) — mirrors the website.
  const topLevel = (data ?? []).filter((c) => !c.parentId);

  const tiles = topLevel.map((c) => ({
    title: c.name,
    slug: c.slug,
    source: c.image ? { uri: c.image } : undefined,
  }));

  const ref = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const realLen = tiles.length;
  const canLoop = realLen > COLS;
  // Duplicate the tiles so we can wrap around seamlessly.
  const loopTiles = canLoop ? [...tiles, ...tiles] : tiles;

  useEffect(() => {
    if (!canLoop) return;
    const t = setInterval(() => {
      if (pausedRef.current) return;
      const next = indexRef.current + 1;
      ref.current?.scrollTo({ x: next * STEP, animated: true });
      indexRef.current = next;
      if (next >= realLen) {
        setTimeout(() => {
          if (pausedRef.current) return;
          const back = next - realLen;
          ref.current?.scrollTo({ x: back * STEP, animated: false });
          indexRef.current = back;
        }, 450);
      }
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [canLoop, realLen]);

  const onScrollBeginDrag = () => {
    pausedRef.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    let idx = Math.round(e.nativeEvent.contentOffset.x / STEP);
    if (canLoop && idx >= realLen) {
      idx -= realLen;
      ref.current?.scrollTo({ x: idx * STEP, animated: false });
    }
    indexRef.current = idx;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      pausedRef.current = false;
    }, RESUME_MS);
  };

  // Nothing to show until real categories exist — no stand-in tiles.
  if (!tiles.length) return null;

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={STEP}
      snapToAlignment="start"
      decelerationRate="normal"
      onScrollBeginDrag={onScrollBeginDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      contentContainerStyle={{ paddingHorizontal: GAP, gap: GAP, paddingBottom: 10 }}
    >
      {loopTiles.map((t, i) => (
        <Tile key={`${t.slug}-${i}`} title={t.title} slug={t.slug} source={t.source} />
      ))}
    </ScrollView>
  );
}
