import { forwardRef, useState } from "react";
import { Pressable, Text, TextInput, TextInputProps, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "../../lib/utils/cn";
import { colors } from "../../theme/tokens";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  secure?: boolean;
  containerClassName?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, secure, containerClassName, ...props },
  ref
) {
  const [hidden, setHidden] = useState(!!secure);

  return (
    <View className={cn("w-full", containerClassName)}>
      {label ? (
        <Text className="mb-1.5 text-sm font-jakarta-medium text-text">{label}</Text>
      ) : null}
      <View
        className={cn(
          "w-full flex-row items-center rounded-lg border bg-surface px-3",
          error ? "border-danger" : "border-border"
        )}
      >
        <TextInput
          ref={ref}
          className="flex-1 py-3 text-base text-text"
          placeholderTextColor={colors.muted}
          secureTextEntry={hidden}
          {...props}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
            <Ionicons
              name={hidden ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="mt-1 text-xs text-danger">{error}</Text> : null}
    </View>
  );
});
