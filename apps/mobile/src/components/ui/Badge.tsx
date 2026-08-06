import { Text, View } from "react-native";
import type { BadgeColor } from "../../lib/enums";

export function Badge({ label, color }: { label: string; color: BadgeColor }) {
  return (
    <View
      style={{ backgroundColor: color.bg }}
      className="self-start rounded-full px-2.5 py-1"
    >
      <Text style={{ color: color.fg }} className="text-xs font-jakarta-semibold">
        {label}
      </Text>
    </View>
  );
}
