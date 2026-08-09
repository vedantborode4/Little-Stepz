import { Platform, ViewStyle } from "react-native";

// Mirrors web --shadow-card: 0 10px 30px rgba(0,0,0,0.06).
// NativeWind shadow support is limited, so expose a style object.
export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
  },
  android: {
    elevation: 3,
  },
  default: {},
}) as ViewStyle;
