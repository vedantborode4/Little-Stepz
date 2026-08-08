import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useCartStore } from "../../store/cart.store";
import { useWishlistStore } from "../../store/wishlist.store";
import { useProductFilterStore } from "../../store/productFilter.store";
import { NotificationBell } from "../notifications/NotificationBell";
import { useThemeColors } from "../../theme/useThemeColors";

function IconButton({
  icon,
  count,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} className="relative p-2">
      <Ionicons name={icon} size={24} color={color} />
      {count > 0 ? (
        <View className="absolute right-0 top-0 min-w-4 items-center justify-center rounded-full bg-primary px-1">
          <Text className="text-[10px] font-jakarta-bold text-white">{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function HomeHeader() {
  // useThemeColors() (not the static `colors` getter) so the icons re-render and
  // stay visible when the colour scheme is dark.
  const c = useThemeColors();
  const cartCount = useCartStore((s) => s.items.reduce((a, i) => a + i.quantity, 0));
  const wishlistCount = useWishlistStore((s) => s.items.length);
  const setSearch = useProductFilterStore((s) => s.setSearch);
  const setFocusSearch = useProductFilterStore((s) => s.setFocusSearch);

  const goSearch = () => {
    setSearch("");
    setFocusSearch(true); // auto-focus the search field on the Shop tab
    router.push("/search");
  };

  return (
    <View className="gap-3 px-4 pt-1">
      <View className="flex-row items-center justify-between">
        <Image
          source={require("../../../assets/images/logo.webp")}
          style={{ height: 38, width: 86 }}
          contentFit="contain"
          contentPosition="left"
        />
        <View className="flex-row items-center">
          <NotificationBell />
          <IconButton icon="heart-outline" count={wishlistCount} color={c.text} onPress={() => router.push("/(tabs)/wishlist")} />
          <IconButton icon="cart-outline" count={cartCount} color={c.text} onPress={() => router.push("/(tabs)/cart")} />
        </View>
      </View>

      <Pressable
        onPress={goSearch}
        className="flex-row items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5"
      >
        <Ionicons name="search" size={18} color={c.muted} />
        <Text className="text-sm text-muted">Search for toys & cars</Text>
      </Pressable>
    </View>
  );
}
