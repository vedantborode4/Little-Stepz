import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useThemeColors } from "../../theme/useThemeColors";
import { useCartStore } from "../../store/cart.store";

function CartIcon({ color, size }: { color: string; size: number }) {
  const count = useCartStore((s) => s.items.reduce((a, i) => a + i.quantity, 0));
  return (
    <View>
      <Ionicons name="cart-outline" size={size} color={color} />
      {count > 0 ? (
        <View className="absolute -right-2 -top-1 min-w-4 items-center justify-center rounded-full bg-primary px-1">
          <Text className="text-[10px] font-jakarta-bold text-white">{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const colors = useThemeColors();
  const bottomInset = useBottomInset();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        // The bottom inset is floored (see useBottomInset) so the bar clears an
        // Android 3-button nav bar, which can report an inset of 0 while still
        // occupying the bottom of the screen. paddingTop is 6 rather than 8 to
        // rebalance: the extra room below would otherwise make the row look like
        // it had drifted upward inside the bar.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 56 + bottomInset,
          paddingTop: 2,
          // +4 over the inset floor: a small breathing gap under the labels so the
          // row never sits flush against the device's navigation area.
          paddingBottom: bottomInset + 4,
        },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarLabelStyle: { fontFamily: "Jakarta-SemiBold", fontSize: 11, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: "Shop", tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{ title: "Cart", tabBarIcon: ({ color, size }) => <CartIcon color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="preorders"
        options={{ title: "Pre-Orders", tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} /> }}
      />
      {/* Wishlist stays reachable (from Account) but is no longer a bottom-bar tab. */}
      <Tabs.Screen name="wishlist" options={{ href: null }} />
      {/* Category lives inside the tab navigator so it keeps the bottom menu while
          browsing. href: null keeps it out of the bar itself — it's reached from
          Home. The URL is unchanged (`(tabs)` is a group, so it isn't in the path),
          so every existing /category/<slug> link still resolves. */}
      <Tabs.Screen name="category/[slug]" options={{ href: null }} />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
