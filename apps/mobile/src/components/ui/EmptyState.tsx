import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/tokens";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = "cube-outline", title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Ionicons name={icon} size={56} color={colors.muted} />
      <Text className="mt-4 text-center text-lg font-jakarta-semibold text-text">{title}</Text>
      {subtitle ? (
        <Text className="mt-1 text-center text-sm text-muted">{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-5 w-48">
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
