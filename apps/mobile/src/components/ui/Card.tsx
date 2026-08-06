import { View, ViewProps } from "react-native";
import { cn } from "../../lib/utils/cn";
import { cardShadow } from "../../theme/shadows";

interface CardProps extends ViewProps {
  className?: string;
  elevated?: boolean;
}

export function Card({ className, elevated = true, style, children, ...props }: CardProps) {
  return (
    <View
      className={cn("rounded-lg bg-surface p-4", className)}
      style={[elevated ? cardShadow : undefined, style]}
      {...props}
    >
      {children}
    </View>
  );
}
