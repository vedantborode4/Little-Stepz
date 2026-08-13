import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../theme/useThemeColors";
import { useCartStore } from "../../store/cart.store";

/** The icon + label row, excluding any padding around it. */
const TAB_ROW_HEIGHT = 50;
const TAB_ROW_PADDING_TOP = 2;

/**
 * Visible white space below the labels — what the user actually sees.
 *
 * The bar is drawn edge-to-edge, so its bottom `insets.bottom` dp are *behind*
 * the system navigation. The gap you can see is therefore
 * `paddingBottom - insets.bottom`, which is exactly what these two set. Sizing
 * the padding directly (as this file used to) makes the visible result depend on
 * a device value, which is why it read as flush on some phones and not others.
 */
const GESTURE_NAV_GAP = 4;
const BUTTON_NAV_GAP = 20;

/**
 * Whether the device's bottom navigation is buttons rather than a gesture pill.
 *
 * Android bottom insets fall into three unambiguous bands:
 *   0-11   nav bar drawn outside the app viewport (legacy 3-button) — the tab
 *          bar lands straight on the buttons with nothing between them
 *   12-36  gesture pill (~16-24 on Android, 34 for the iOS home indicator)
 *   37+    3-button nav bar measured edge-to-edge (~48)
 * Only the middle band reserves usable space of its own. iOS has no button
 * navigation, so it always keeps the gesture gap.
 */
function usesButtonNav(bottomInset: number): boolean {
  return Platform.OS === "android" && (bottomInset < 12 || bottomInset > 36);
}

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
  const insets = useSafeAreaInsets();

  const gap = usesButtonNav(insets.bottom) ? BUTTON_NAV_GAP : GESTURE_NAV_GAP;
  const paddingBottom = insets.bottom + gap;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: TAB_ROW_PADDING_TOP + TAB_ROW_HEIGHT + paddingBottom,
          paddingTop: TAB_ROW_PADDING_TOP,
          paddingBottom,
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
