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
        // Extra vertical padding so the icons/labels aren't cramped against the
        // screen edge, plus the device's safe-area inset at the bottom. Devices
        // with a 3-button nav bar report bottom inset 0 (the bar sits outside the
        // app window), so floor it to keep the labels clear of the buttons.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 58 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset + 8,
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
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
