import { useEffect } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AppearanceCard } from "../../components/settings/AppearanceCard";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/auth.store";
import { useAuth } from "../../hooks/useAuth";
import { UserService } from "../../lib/services/user.service";
import { AffiliateService } from "../../features/affiliate/services/affiliate.service";
import { setUser as persistUser } from "../../lib/api/token";
import { qk } from "../../lib/api/query-client";
import { colors } from "../../theme/tokens";
import { useIsDark } from "../../theme/useThemeColors";

/**
 * Menu-row icons: brand red in light mode. Dark mode keeps the light-on-dark
 * text colour — red on the dark surface reads as an alert rather than a glyph.
 */
function useRowIconColor() {
  const isDark = useIsDark();
  return isDark ? colors.text : colors.primary;
}

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; href: string; role?: string };

const rows: Row[] = [
  { icon: "receipt-outline", label: "My Orders", href: "/orders" },
  { icon: "navigate-outline", label: "Track Order", href: "/orders" },
  { icon: "time-outline", label: "My Pre-Orders", href: "/pre-orders" },
  { icon: "notifications-outline", label: "Notifications", href: "/notifications" },
  { icon: "location-outline", label: "Addresses", href: "/address" },
  { icon: "heart-outline", label: "Wishlist", href: "/(tabs)/wishlist" },
  { icon: "person-outline", label: "Profile", href: "/profile" },
];

const legalRows: Row[] = [
  { icon: "help-circle-outline", label: "FAQ", href: "/legal/faq" },
  { icon: "ribbon-outline", label: "Authenticity & Unboxing", href: "/legal/authenticity" },
  { icon: "information-circle-outline", label: "About Us", href: "/legal/about" },
  { icon: "cube-outline", label: "Shipping Policy", href: "/legal/shipping" },
  { icon: "return-down-back-outline", label: "Returns & Refund", href: "/legal/returns" },
  { icon: "close-circle-outline", label: "Cancellation Policy", href: "/legal/cancellation" },
  { icon: "shield-checkmark-outline", label: "Warranty & Safety", href: "/legal/warranty" },
  { icon: "lock-closed-outline", label: "Privacy Policy", href: "/legal/privacy" },
  { icon: "document-text-outline", label: "Terms & Conditions", href: "/legal/terms" },
];

/** Prominent "Chat with us" entry — shown to signed-in and signed-out users alike. */
function ChatWithUsCard() {
  return (
    <Card elevated clip className="p-0">
      <Pressable
        onPress={() => router.push("/support")}
        className="flex-row items-center gap-3 px-4 py-4"
      >
        <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="text-base font-jakarta-semibold text-text">Chat with us</Text>
          <Text className="text-xs text-muted">Questions about an order or a product? We&apos;re here to help.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </Card>
  );
}

/** Legal & Policies list — shown to signed-in and signed-out users alike. */
function LegalPoliciesSection() {
  const iconColor = useRowIconColor();
  return (
    <View className="gap-3">
      <Text className="px-1 text-xs font-jakarta-semibold uppercase tracking-wide text-muted">
        Legal & Policies
      </Text>
      <Card elevated clip className="p-0">
        {legalRows.map((r, i) => (
          <Pressable
            key={r.label}
            onPress={() => router.push(r.href as any)}
            className={`flex-row items-center gap-3 px-4 py-4 ${i < legalRows.length - 1 ? "border-b border-border" : ""}`}
          >
            <Ionicons name={r.icon} size={20} color={iconColor} />
            <Text className="flex-1 text-base text-text">{r.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

export default function Account() {
  const { user, isAuthenticated } = useAuthStore();
  const setUserOnly = useAuthStore((s) => s.setUserOnly);
  const { signOut } = useAuth();
  const rowIconColor = useRowIconColor();

  // Refresh the profile so role changes (e.g. promoted to ADMIN on the backend)
  // are reflected here, matching the website. Keeps the persisted copy in sync.
  const meQuery = useQuery({
    queryKey: qk.me,
    queryFn: () => UserService.getMe(),
    enabled: isAuthenticated,
  });
  useEffect(() => {
    if (meQuery.data?.id) {
      setUserOnly(meQuery.data);
      persistUser(meQuery.data);
    }
  }, [meQuery.data, setUserOnly]);

  // Affiliate status comes from /affiliate/me (independent of role) — mirrors web.
  const affiliateQuery = useQuery({
    queryKey: qk.affiliateMe,
    queryFn: () => AffiliateService.getMe(),
    enabled: isAuthenticated,
    retry: false,
  });

  const role = meQuery.data?.role ?? user?.role;
  const affiliateStatus: string | undefined = affiliateQuery.data?.status;

  if (!isAuthenticated) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View className="items-center px-6 py-8">
            <Ionicons name="person-circle-outline" size={72} color={colors.muted} />
            <Text className="mt-3 text-lg font-jakarta-semibold text-text">You&apos;re not signed in</Text>
            <Text className="mb-6 mt-1 text-center text-sm text-muted">
              Sign in to view orders, wishlist and more.
            </Text>
            <View className="w-56">
              <Button label="Sign In" onPress={() => router.push("/(auth)/signin")} />
            </View>
          </View>

          <ChatWithUsCard />

          <AppearanceCard />

          <LegalPoliciesSection />

          {/* Affiliate signup is worth advertising to guests too. Kept in the same
              position it occupies when signed in, so it doesn't move on login.
              Sign-in is required to apply, so route through it and come back. */}
          <Button
            label="Become an Affiliate"
            variant="outline"
            onPress={() =>
              router.push({
                pathname: "/(auth)/signin",
                params: { redirect: "/affiliate/apply" },
              })
            }
          />
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Text className="text-lg font-jakarta-bold text-white">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-jakarta-semibold text-text">{user?.name}</Text>
            <Text className="text-sm text-muted">{user?.email}</Text>
          </View>
        </Card>

        <ChatWithUsCard />

        <Card elevated clip className="p-0">
          {rows.map((r, i) => (
            <Pressable
              key={r.label}
              onPress={() => router.push(r.href as any)}
              className={`flex-row items-center gap-3 px-4 py-4 ${i < rows.length - 1 ? "border-b border-border" : ""}`}
            >
              <Ionicons name={r.icon} size={20} color={rowIconColor} />
              <Text className="flex-1 text-base text-text">{r.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </Card>

        <AppearanceCard />

        <LegalPoliciesSection />

        {/* Affiliate — status-driven (approved / pending / rejected / none) */}
        {affiliateStatus === "APPROVED" ? (
          <Button label="Affiliate Dashboard" variant="outline" onPress={() => router.push("/affiliate")} />
        ) : affiliateStatus === "PENDING" ? (
          <View className="flex-row items-center justify-center gap-2 rounded-md border border-warning/40 bg-warning/10 py-3">
            <Ionicons name="time-outline" size={16} color={colors.warning} />
            <Text className="text-sm font-jakarta-medium text-warning">Affiliate approval pending</Text>
          </View>
        ) : affiliateStatus === "REJECTED" ? (
          <Button label="Reapply as Affiliate" variant="outline" onPress={() => router.push("/affiliate/apply")} />
        ) : (
          <Button label="Become an Affiliate" variant="outline" onPress={() => router.push("/affiliate/apply")} />
        )}

        {/* Admin Panel — directly below the affiliate section, for ADMIN accounts */}
        {role === "ADMIN" ? (
          <Button label="Admin Panel" variant="outline" onPress={() => router.push("/admin")} />
        ) : null}

        <Button label="Sign Out" variant="danger" onPress={signOut} />
      </ScrollView>
    </ScreenContainer>
  );
}
