import { Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import type { BadgeColor } from "../../lib/enums";

type Swatch = { bg: string; fg: string };

/** Light values are exactly the previous palette — light mode is unchanged. */
const LIGHT: Record<BadgeColor, Swatch> = {
  gray: { bg: "#F3F4F6", fg: "#374151" },
  blue: { bg: "#DBEAFE", fg: "#1D4ED8" },
  indigo: { bg: "#E0E7FF", fg: "#4338CA" },
  amber: { bg: "#FEF3C7", fg: "#B45309" },
  green: { bg: "#DCFCE7", fg: "#15803D" },
  red: { bg: "#FEE2E2", fg: "#B91C1C" },
  purple: { bg: "#F3E8FF", fg: "#7E22CE" },
  teal: { bg: "#CCFBF1", fg: "#0F766E" },
};

/**
 * Dark: the same hues inverted — a deep, desaturated fill with a light readable
 * label, so a chip sits on a dark card instead of glowing against it.
 */
const DARK: Record<BadgeColor, Swatch> = {
  gray: { bg: "#2A2A34", fg: "#D1D5DB" },
  blue: { bg: "#1E3A5F", fg: "#93C5FD" },
  indigo: { bg: "#2A2F5F", fg: "#A5B4FC" },
  amber: { bg: "#452F13", fg: "#FCD34D" },
  green: { bg: "#14361F", fg: "#86EFAC" },
  red: { bg: "#451A1A", fg: "#FCA5A5" },
  purple: { bg: "#39204D", fg: "#D8B4FE" },
  teal: { bg: "#123A36", fg: "#5EEAD4" },
};

export function Badge({ label, color }: { label: string; color: BadgeColor }) {
  // Subscribing here (rather than reading a module constant) is what makes the
  // chip re-render and re-resolve when the colour scheme changes.
  const { colorScheme } = useColorScheme();
  const swatch = (colorScheme === "dark" ? DARK : LIGHT)[color] ?? LIGHT.gray;

  return (
    <View
      style={{ backgroundColor: swatch.bg }}
      className="self-start rounded-full px-2.5 py-1"
    >
      <Text style={{ color: swatch.fg }} className="text-xs font-jakarta-semibold">
        {label}
      </Text>
    </View>
  );
}
