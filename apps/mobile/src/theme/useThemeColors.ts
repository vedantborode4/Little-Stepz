import { useColorScheme } from "nativewind";
import { darkColors, lightColors, setResolvedScheme, type ThemeColors } from "./tokens";

/**
 * Theme-aware raw colour values, for places that can't take a className:
 * Ionicons `color=`, StatusBar, tab bar, charts, inline styles. Re-renders the
 * component when the scheme changes.
 */
export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  // Keep the raw `colors` proxy on the same scheme as the classes. The root
  // layout calls this on every render, so it is in sync before children paint.
  setResolvedScheme(dark ? "dark" : "light");
  return dark ? darkColors : lightColors;
}

/** True when the resolved scheme is dark (for StatusBar / image overlays). */
export function useIsDark(): boolean {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  setResolvedScheme(dark ? "dark" : "light");
  return dark;
}
