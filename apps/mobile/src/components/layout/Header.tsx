import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "../../lib/utils/cn";
import { colors } from "../../theme/tokens";

interface HeaderProps {
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
  className?: string;
  /** Root tabs have nothing to go back to — hide the chevron. */
  showBack?: boolean;
}

export function Header({ title, right, onBack, className, showBack = true }: HeaderProps) {
  return (
    <View className={cn("flex-row items-center gap-2 border-b border-border bg-surface px-3 py-2.5", className)}>
      {showBack ? (
        <Pressable onPress={onBack ?? (() => router.back())} hitSlop={8} className="p-1">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ) : null}
      <Text numberOfLines={1} className={cn("flex-1 text-lg font-jakarta-semibold text-text", !showBack && "pl-1")}>
        {title}
      </Text>
      {right}
    </View>
  );
}
