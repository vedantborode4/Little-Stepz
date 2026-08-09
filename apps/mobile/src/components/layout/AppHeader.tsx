import { View } from "react-native";

import { HomeHeader } from "../home/HomeHeader";

/**
 * The storefront header (logo + search + wishlist/cart), used on the root tabs
 * (Home, Wishlist, Pre-Order) so they share one consistent top bar.
 */
export function AppHeader() {
  return (
    <View className="border-b border-border bg-surface pb-3">
      <HomeHeader />
    </View>
  );
}
