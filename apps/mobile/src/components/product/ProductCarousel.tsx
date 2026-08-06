import { useEffect, useRef } from "react";
import { Dimensions, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { ProductCard } from "./ProductCard";
import type { Product } from "../../types/product";

// Size cards so a WHOLE number fit the viewport — never a half card at the edge.
// Keeping the outer padding equal to the gap makes every snap position land
// exactly on card boundaries (no edge sliver).
const { width } = Dimensions.get("window");
const GAP = 16;
const TARGET = 172; // preferred card width; the real width is derived to fit evenly
const COLS = Math.max(2, Math.floor((width - GAP) / (TARGET + GAP)));
const CARD_W = (width - (COLS + 1) * GAP) / COLS;
const STEP = CARD_W + GAP;

const AUTO_MS = 3500; // gentle auto-advance interval
const RESUME_MS = 4000; // wait this long after a manual swipe before auto-scrolling resumes

/**
 * Horizontal product carousel used across the home sections.
 *
 * Built on a plain ScrollView (not FlatList) — these rows hold only a handful
 * of cards, so virtualization isn't needed and this avoids the "VirtualizedList
 * nested inside a ScrollView is slow" warning on the home screen.
 *
 * Auto-advances slowly and loops infinitely (the track is duplicated so it wraps
 * back seamlessly), pausing while the user interacts so a card never slides out
 * from under them (client 4.1). Cards fit the screen an exact number of times
 * and snap to card boundaries — always fully visible or not at all.
 */
export function ProductCarousel({ products }: { products: Product[] }) {
  const ref = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const realLen = products.length;
  const canLoop = realLen > COLS; // only auto-scroll when there's something to scroll
  // Duplicate the track so we can wrap around without a visible jump.
  const data = canLoop ? [...products, ...products] : products;

  useEffect(() => {
    if (!canLoop) return;
    const t = setInterval(() => {
      if (pausedRef.current) return;
      const next = indexRef.current + 1;
      ref.current?.scrollTo({ x: next * STEP, animated: true });
      indexRef.current = next;
      // Once we've advanced a full set into the duplicate, silently rewind by
      // one set — the card shown is identical, so the jump is invisible.
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

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: GAP, gap: GAP, paddingTop: 4, paddingBottom: 14 }}
      snapToInterval={STEP}
      snapToAlignment="start"
      decelerationRate="normal"
      onScrollBeginDrag={onScrollBeginDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
    >
      {data.map((item, i) => (
        <View key={`${item.id}-${i}`} style={{ width: CARD_W }}>
          <ProductCard product={item} />
        </View>
      ))}
    </ScrollView>
  );
}
