import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Floor applied when the device reports no bottom inset (3-button nav bar). */
const MIN_BOTTOM_INSET = 12;

/**
 * Bottom safe-area inset, floored so content always clears the navigation bar.
 *
 * Gesture-nav devices report a real inset (~20-34) and are unaffected. Devices
 * with a 3-button nav bar report 0 — the bar sits outside the app window — which
 * leaves content jammed against the buttons, so we substitute a small gap.
 *
 * Use in any screen that draws to the bottom edge. Screens inside the tab
 * navigator do NOT need it: the tab bar already covers the inset.
 */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, MIN_BOTTOM_INSET);
}
