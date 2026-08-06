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

  return <Animated.View style={[{ opacity }, style]} className={`rounded-md bg-border ${className ?? ""}`} />;
}

/** A product-card-shaped skeleton tile. */
export function ProductCardSkeleton() {
  return (
    <View className="overflow-hidden rounded-xl bg-surface p-2.5" style={{ gap: 8 }}>
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </View>
  );
}
