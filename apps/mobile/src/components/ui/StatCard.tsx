import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { colors } from "../../theme/tokens";

interface StatCardProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tint?: string;
  sub?: string;
}

export function StatCard({ label, value, icon, tint = colors.primary, sub }: StatCardProps) {
  return (
    <Card className="flex-1 gap-1">
      <View className="flex-row items-start justify-between">
        <Text className="flex-1 text-xs text-muted">{label}</Text>
        {icon ? (
          <View style={{ backgroundColor: tint + "20" }} className="ml-1 h-8 w-8 items-center justify-center rounded-full">
            <Ionicons name={icon} size={16} color={tint} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} className="text-xl font-jakarta-bold text-text">{value}</Text>
      {sub ? <Text numberOfLines={1} className="text-[10px] text-muted">{sub}</Text> : null}
    </Card>
  );
}
