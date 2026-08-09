import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "../../theme/useThemeColors";
import { formatRelative } from "../../lib/utils/format";
import { notificationIcon } from "../../lib/notificationIcon";
import type { AppNotification } from "../../types/notification";

export function NotificationRow({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: (n: AppNotification) => void;
}) {
  const colors = useThemeColors();
  const unread = !notification.readAt;

  return (
    <Pressable
      onPress={() => onPress(notification)}
      className={`flex-row gap-3 px-4 py-3.5 ${unread ? "bg-primary/5" : ""}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-2">
        <Ionicons name={notificationIcon(notification.type)} size={20} color={colors.primary} />
      </View>

      <View className="flex-1">
        <View className="flex-row items-start gap-2">
          <Text
            className={`flex-1 text-[15px] ${unread ? "font-jakarta-semibold text-text" : "font-jakarta-medium text-text"}`}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          {unread ? <View className="mt-1.5 h-2 w-2 rounded-full bg-primary" /> : null}
        </View>
        <Text className="mt-0.5 text-sm text-muted" numberOfLines={2}>
          {notification.body}
        </Text>
        <Text className="mt-1 text-xs text-muted">{formatRelative(notification.createdAt)}</Text>
      </View>
    </Pressable>
  );
}
