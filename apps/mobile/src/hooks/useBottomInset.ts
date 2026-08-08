import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Floor applied when the device reports little or no bottom inset.
 *
 * Sized to clear an Android 3-button navigation bar. Those devices can report a
 * bottom inset of 0 even though the buttons visually occupy the bottom of the
 * screen, so anything pinned to the bottom lands on top of them. The previous
 * floor of 12 was not enough and the tab bar collided with the nav buttons.
 */
const MIN_BOTTOM_INSET = 10;

/**
 * Bottom safe-area inset, floored so content always clears the navigation bar.
 *
 * Gesture-nav devices report a real inset (~20-34) and are returned unchanged —
 * the floor only affects the devices that report less than it, which are exactly
 * the ones that collide.
 *
 * Use in any screen that draws to the bottom edge. Screens inside the tab
 * navigator do NOT need it: the tab bar already covers the inset.
 */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, MIN_BOTTOM_INSET);
}

/**
 * Only the *top-up* over the real inset.
 *
 * For containers that already apply the true safe-area inset themselves (a
 * SafeAreaView with a "bottom" edge, for instance) — adding the full floor there
 * would double-count. This returns just the shortfall, so the total clearance
 * still reaches MIN_BOTTOM_INSET.
 */
export function useExtraBottomInset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(0, MIN_BOTTOM_INSET - insets.bottom);
}
