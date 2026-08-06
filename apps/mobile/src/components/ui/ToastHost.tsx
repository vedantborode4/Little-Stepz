import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useToastStore, type ToastType } from "../../store/toast.store";
import { useIsDark } from "../../theme/useThemeColors";

const ICON: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "alert-circle",
  info: "information-circle",
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();
  const isDark = useIsDark();

  // Toasts float over content with white text, so success/error keep their
  // saturated backgrounds in both themes. Only the neutral "info" toast is
  // lightened in dark mode so its edge separates from the dark app surface.
  const bgFor: Record<ToastType, string> = {
    success: "#16A34A",
    error: "#DC2626",
    info: isDark ? "#3F3F46" : "#1F2937",
  };

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{ bottom: insets.bottom + 72 }}
      className="absolute left-0 right-0 z-50 items-center px-4"
    >
      {toasts.map((t) => {
        return (
          <View
            key={t.id}
            style={{ backgroundColor: bgFor[t.type] }}
            className="mb-2 w-full max-w-md flex-row items-center gap-2 rounded-md px-4 py-3"
          >
            <Ionicons name={ICON[t.type]} size={18} color="#fff" />
            <Text className="flex-1 text-sm font-jakarta-medium text-white">{t.message}</Text>
          </View>
        );
      })}
    </View>
  );
}
