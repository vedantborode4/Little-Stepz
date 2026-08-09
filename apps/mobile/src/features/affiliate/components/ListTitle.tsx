import { Text, View } from "react-native";

export function ListTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-1">
      <Text className="text-lg font-jakarta-bold text-text">{title}</Text>
      {subtitle ? <Text className="text-xs text-muted">{subtitle}</Text> : null}
    </View>
  );
}
