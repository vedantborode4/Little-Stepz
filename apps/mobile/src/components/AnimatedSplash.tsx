import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { colors } from "../theme/tokens";

/**
 * Branded splash overlay — the logo "pops" in (spring scale + fade), holds
 * briefly, then the whole overlay fades out to reveal the app.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 4.5, tension: 90, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.timing(containerOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start(() => onDoneRef.current());
    // Run the pop animation exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", opacity: containerOpacity, zIndex: 100 },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }], opacity: logoOpacity }}>
        <Image
          source={require("../../assets/images/logo.webp")}
          style={{ width: 220, height: 90 }}
          contentFit="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}
