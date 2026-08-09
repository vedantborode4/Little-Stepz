import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface RatingProps {
  value: number;
  size?: number;
  count?: number;
  editable?: boolean;
  onChange?: (value: number) => void;
}

export function Rating({ value, size = 14, count, editable = false, onChange }: RatingProps) {
  return (
    <View className="flex-row items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const name = i <= Math.round(value) ? "star" : "star-outline";
        const star = <Ionicons name={name} size={size} color="#F59E0B" />;
        return editable ? (
          <Pressable key={i} hitSlop={6} onPress={() => onChange?.(i)}>
            {star}
          </Pressable>
        ) : (
          <View key={i}>{star}</View>
        );
      })}
      {typeof count === "number" ? (
        <Text className="ml-1 text-xs text-muted">({count})</Text>
      ) : null}
    </View>
  );
}
