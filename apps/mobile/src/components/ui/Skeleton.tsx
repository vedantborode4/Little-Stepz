import { useEffect, useRef } from "react";
import { Animated, View, type ViewStyle } from "react-native";

/** Pulsing placeholder block (Expo Go safe — core Animated only). */
export function Skeleton({ className, style }: { className?: string; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  // surface-3, not border: the light-mode border token (#F1F5F9) against a white
  // card is ~2% contrast, so skeletons read as blank space rather than loading.
  return <Animated.View style={[{ opacity }, style]} className={`rounded-md bg-surface-3 ${className ?? ""}`} />;
}

/**
 * A product-card-shaped skeleton tile. Mirrors ProductCard's structure exactly
 * (full-bleed square image, h-8 title, fixed price block, h-8 button) so the
 * skeleton → data swap doesn't shift the grid.
 */
export function ProductCardSkeleton() {
  return (
    <View className="h-full overflow-hidden rounded-xl bg-surface">
      <Skeleton className="aspect-square w-full rounded-none" />
      <View className="flex-1 p-2.5">
        <View className="h-8 justify-start gap-1">
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-2/3" />
        </View>
        <View className="mb-2 mt-0.5 justify-center" style={{ height: 44 }}>
          <Skeleton className="h-4 w-3/5" />
        </View>
        <Skeleton className="mt-auto h-8 w-full rounded-lg" />
      </View>
    </View>
  );
}
