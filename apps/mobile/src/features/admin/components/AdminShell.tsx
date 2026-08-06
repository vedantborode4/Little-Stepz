import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBottomInset } from "../../../hooks/useBottomInset";
import { colors } from "../../../theme/tokens";

type NavItem = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; route: string };

const dashboard: NavItem = { key: "dashboard", label: "Dashboard", icon: "grid-outline", route: "/admin" };

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Catalogue",
    items: [
      { key: "products", label: "Products", icon: "cube-outline", route: "/admin/products" },
      { key: "categories", label: "Categories", icon: "pricetags-outline", route: "/admin/categories" },
      { key: "banners", label: "Banners", icon: "image-outline", route: "/admin/banners" },
    ],
  },
  {
    title: "Commerce",
    items: [
      { key: "orders", label: "Orders", icon: "receipt-outline", route: "/admin/orders" },
      { key: "pre-orders", label: "Pre-Orders", icon: "time-outline", route: "/admin/pre-orders" },
      { key: "coupons", label: "Coupons", icon: "ticket-outline", route: "/admin/coupons" },
      { key: "reviews", label: "Reviews", icon: "star-outline", route: "/admin/reviews" },
    ],
  },
  {
    title: "Affiliate",
    items: [
      { key: "affiliates", label: "Affiliates", icon: "people-outline", route: "/admin/affiliates" },
      { key: "commissions", label: "Commissions", icon: "cash-outline", route: "/admin/commissions" },
      { key: "withdrawals", label: "Withdrawals", icon: "wallet-outline", route: "/admin/withdrawals" },
    ],
  },
  {
    title: "Finance",
    items: [
      { key: "profit-loss", label: "Profit & Loss", icon: "trending-up-outline", route: "/admin/profit-loss" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { key: "notifications", label: "Notifications", icon: "notifications-outline", route: "/admin/notifications" },
    ],
  },
];

export function AdminShell({
  active,
  title,
  children,
  right,
}: {
  active: string;
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  // Admin screens use edges={["top","left","right"]} and there is no tab bar
  // below them, so the bottom inset has to be applied here.
  const bottomInset = useBottomInset();

  const go = (route: string) => {
    setOpen(false);
    router.replace(route as any);
  };

  return (
    <View className="flex-1 bg-bg">
      {/* Top bar */}
      <View className="flex-row items-center gap-2 border-b border-border bg-surface px-3 py-3">
        <Pressable onPress={() => setOpen(true)} hitSlop={8} className="p-1">
          <Ionicons name="menu" size={24} color={colors.text} />
        </Pressable>
        <Text className="flex-1 text-lg font-jakarta-semibold text-text">{title}</Text>
        {right}
      </View>

      <View className="flex-1" style={{ paddingBottom: bottomInset }}>
        {children}
      </View>

      {/* Drawer */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 flex-row bg-black/40" onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ paddingTop: insets.top + 12, width: 280 }}
            className="h-full bg-surface"
          >
            <Text className="px-4 pb-3 text-xl font-jakarta-bold text-primary">Little Stepz Admin</Text>
            <ScrollView contentContainerStyle={{ paddingBottom: bottomInset }}>
              {(() => {
                const on = dashboard.key === active;
                return (
                  <Pressable
                    onPress={() => go(dashboard.route)}
                    className={`flex-row items-center gap-3 px-4 py-3 ${on ? "bg-primary/10" : ""}`}
                  >
                    <Ionicons name={dashboard.icon} size={20} color={on ? colors.primary : colors.text} />
                    <Text className={on ? "font-jakarta-semibold text-primary" : "text-text"}>{dashboard.label}</Text>
                  </Pressable>
                );
              })()}

              {SECTIONS.map((section) => (
                <View key={section.title}>
                  <Text className="px-4 pb-1 pt-3 text-[10px] font-jakarta-semibold uppercase tracking-wide text-muted">
                    {section.title}
                  </Text>
                  {section.items.map((n) => {
                    const on = n.key === active;
                    return (
                      <Pressable
                        key={n.key}
                        onPress={() => go(n.route)}
                        className={`flex-row items-center gap-3 px-4 py-3 ${on ? "bg-primary/10" : ""}`}
                      >
                        <Ionicons name={n.icon} size={20} color={on ? colors.primary : colors.text} />
                        <Text className={on ? "font-jakarta-semibold text-primary" : "text-text"}>{n.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              <View className="my-2 h-px bg-border" />
              <Pressable onPress={() => go("/(tabs)/home")} className="flex-row items-center gap-3 px-4 py-3">
                <Ionicons name="storefront-outline" size={20} color={colors.muted} />
                <Text className="text-muted">Back to Store</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
