import { useRef, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { cldImage } from "../../lib/utils/image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { ProductImage } from "../../types/product";
import { colors } from "../../theme/tokens";

const { width, height } = Dimensions.get("window");
const MAIN_H = Math.round(width * 1.08); // slightly taller than square
const MAX_SCALE = 5;

/**
 * Full-screen zoomable image — pinch to zoom, drag to pan, double-tap to
 * toggle. Reports its zoom state so the pager can disable swiping while zoomed.
 */
function ZoomableImage({
  uri,
  onZoomChange,
}: {
  uri: string;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.max(1, Math.min(next, MAX_SCALE));
    })
    .onEnd(() => {
      if (scale.value <= 1.01) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
        runOnJS(onZoomChange)(false);
      } else {
        savedScale.value = scale.value;
        runOnJS(onZoomChange)(true);
      }
    });

  // Only pans while zoomed in, so swiping between images still works at 1x.
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
        runOnJS(onZoomChange)(false);
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
        runOnJS(onZoomChange)(true);
      }
    });

  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <Animated.Image
          source={{ uri }}
          style={[{ width, height: height * 0.8 }, animatedStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

export function ProductGallery({ images }: { images: ProductImage[] }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const listRef = useRef<FlatList<ProductImage>>(null);
  const insets = useSafeAreaInsets();

  if (!images?.length) {
    return (
      <View style={{ width, height: MAIN_H }} className="items-center justify-center bg-border">
        <Ionicons name="image-outline" size={48} color={colors.faint} />
      </View>
    );
  }

  const scrollTo = (i: number) => {
    setIndex(i);
    listRef.current?.scrollToOffset({ offset: i * width, animated: true });
  };

  const openZoom = () => {
    setZoomed(false);
    setZoom(true);
  };

  const closeZoom = () => {
    setZoomed(false);
    setZoom(false);
  };

  return (
    <View>
      <View>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(img, i) => img.id ?? `${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Pressable onPress={openZoom}>
              {/* contain — show the whole product image without cropping (free-form) */}
              <Image source={{ uri: cldImage(item.url, { w: 1000, crop: "limit" }) }} style={{ width, height: MAIN_H }} contentFit="contain" transition={150} cachePolicy="memory-disk" />
            </Pressable>
          )}
        />

        {images.length > 1 ? (
          <View className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5">
            <Text className="text-[11px] font-jakarta-medium text-white">{index + 1} / {images.length}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={openZoom}
          hitSlop={8}
          className="absolute bottom-3 right-3 h-9 w-9 items-center justify-center rounded-full bg-black/50"
        >
          <Ionicons name="expand-outline" size={18} color="#fff" />
        </Pressable>

        {images.length > 1 ? (
          <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
            {images.map((img, i) => (
              <View
                key={img.id ?? i}
                className={i === index ? "h-1.5 w-4 rounded-full bg-primary" : "h-1.5 w-1.5 rounded-full bg-white/80"}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* Thumbnail strip */}
      {images.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          {images.map((img, i) => (
            <Pressable
              key={img.id ?? i}
              onPress={() => scrollTo(i)}
              style={{ width: 72, height: 72 }}
              className={`overflow-hidden rounded-lg border-2 ${i === index ? "border-primary" : "border-border"}`}
            >
              <Image source={{ uri: cldImage(img.url, { w: 200, h: 200, crop: "fill" }) }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Full-screen zoomable preview */}
      <Modal visible={zoom} transparent={false} animationType="fade" onRequestClose={closeZoom} statusBarTranslucent>
        {/* RNGH needs its own root inside a RN Modal for gestures to register. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View className="flex-1 bg-black">
            <Pressable
              onPress={closeZoom}
              hitSlop={12}
              style={{ top: insets.top + 10 }}
              className="absolute right-4 z-10 h-11 w-11 items-center justify-center rounded-full bg-white/20"
            >
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>

            <FlatList
              data={images}
              keyExtractor={(img, i) => img.id ?? `z-${i}`}
              horizontal
              pagingEnabled
              // Disable paging while zoomed in so panning the image works.
              scrollEnabled={!zoomed}
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={index}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              renderItem={({ item }) => <ZoomableImage uri={item.url} onZoomChange={setZoomed} />}
            />

            <View style={{ bottom: insets.bottom + 16 }} className="absolute left-0 right-0 items-center">
              <Text className="text-xs text-white/70">Pinch or double-tap to zoom</Text>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}
