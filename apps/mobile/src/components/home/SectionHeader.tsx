import { Text, View } from "react-native";

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-5 px-4">
      <Text className="text-center text-3xl font-anton uppercase tracking-wide text-primary">{title}</Text>
      {subtitle ? (
        <Text className="mt-0.5 text-center text-sm text-muted">{subtitle}</Text>
      ) : null}
    </View>
  );
}
