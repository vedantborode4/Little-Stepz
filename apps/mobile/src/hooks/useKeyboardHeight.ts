import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Height the keyboard currently occupies, for lifting absolutely-positioned
 * bottom bars (the cart summary, the checkout footer) clear of it.
 *
 * Android returns 0 by design: its default `adjustResize` already shrinks the app
 * window when the keyboard opens, so a `bottom: 0` element moves up on its own and
 * adding an offset would double-count it. iOS does not resize — the keyboard is an
 * overlay — so there the bar must be lifted manually or it stays hidden underneath.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const show = Keyboard.addListener("keyboardWillChangeFrame", (e) => {
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
