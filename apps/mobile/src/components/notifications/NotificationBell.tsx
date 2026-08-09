import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { NotificationService } from "../../lib/services/notification.service";
import { qk } from "../../lib/api/query-client";
import { useAuthStore } from "../../store/auth.store";
import { useThemeColors } from "../../theme/useThemeColors";

/** Bell button with an unread badge; navigates to the notification center. */
export function NotificationBell({ color }: { color?: string }) {
  const colors = useThemeColors();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: unread = 0 } = useQuery({
    queryKey: qk.notificationsUnread,
    queryFn: () => NotificationService.unreadCount(),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  return (
    <Pressable onPress={() => router.push("/notifications" as never)} hitSlop={6} className="relative p-2">
      <Ionicons name="notifications-outline" size={24} color={color ?? colors.text} />
      {isAuthenticated && unread > 0 ? (
        <View className="absolute right-0 top-0 min-w-4 items-center justify-center rounded-full bg-primary px-1">
          <Text className="text-[10px] font-jakarta-bold text-white">{unread > 99 ? "99+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
