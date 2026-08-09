import { View, ViewProps } from "react-native";
import { cn } from "../../lib/utils/cn";
import { cardShadow } from "../../theme/shadows";

interface CardProps extends ViewProps {
  className?: string;
  elevated?: boolean;
  /**
   * Clip children to the card's radius. Needed for edge-to-edge content (a `p-0`
   * card holding full-bleed rows): a child's background — and on Android its press
   * ripple — otherwise paints square over the rounded corners.
   *
   * Done with an inner wrapper rather than `overflow-hidden` on the card itself,
   * because on iOS that would clip the card's own shadow. Opt-in, since wrapping
   * children would break cards that put flex classes on the outer view.
   */
  clip?: boolean;
}

export function Card({ className, elevated = true, clip, style, children, ...props }: CardProps) {
  return (
    <View
      // The card's separation comes from a black shadow, which is invisible against
      // the near-black dark background. A hairline border restores the edge in dark
      // mode without touching light mode.
      className={cn("rounded-lg bg-surface p-4 dark:border dark:border-border", className)}
      style={[elevated ? cardShadow : undefined, style]}
      {...props}
    >
      {clip ? <View className="overflow-hidden rounded-lg">{children}</View> : children}
    </View>
  );
}
