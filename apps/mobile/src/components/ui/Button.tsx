import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { cn } from "../../lib/utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  left?: React.ReactNode;
}

const base = "flex-row items-center justify-center rounded-md";

const variantBg: Record<Variant, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  outline: "bg-surface border border-border",
  ghost: "bg-transparent",
  danger: "bg-danger",
};

const variantText: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-text",
  ghost: "text-primary",
  danger: "text-white",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-2",
  md: "px-4 py-3",
  lg: "px-5 py-4",
};

const textSizes: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-base",
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = true,
  className,
  left,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={cn(
        base,
        variantBg[variant],
        sizes[size],
        fullWidth && "w-full",
        isDisabled && "opacity-50",
        className
      )}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" || variant === "ghost" ? "#FF383C" : "#fff"} />
      ) : (
        <View className="flex-row items-center gap-2">
          {left}
          <Text className={cn("font-sora", variantText[variant], textSizes[size])}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
