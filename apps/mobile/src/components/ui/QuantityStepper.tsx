import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/tokens";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export function QuantityStepper({ value, onChange, min = 1, max = 99, disabled }: QuantityStepperProps) {
  const dec = () => value > min && onChange(value - 1);
  const inc = () => value < max && onChange(value + 1);

  return (
    <View className="flex-row items-center rounded-md border border-border bg-surface">
      <Pressable onPress={dec} disabled={disabled || value <= min} hitSlop={6} className="px-3 py-2">
        <Ionicons name="remove" size={16} color={value <= min ? colors.muted : colors.text} />
      </Pressable>
      <Text className="min-w-8 text-center font-jakarta-semibold text-text">{value}</Text>
      <Pressable onPress={inc} disabled={disabled || value >= max} hitSlop={6} className="px-3 py-2">
        <Ionicons name="add" size={16} color={value >= max ? colors.muted : colors.text} />
      </Pressable>
    </View>
  );
}
