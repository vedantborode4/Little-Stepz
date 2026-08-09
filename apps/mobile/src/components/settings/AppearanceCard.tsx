import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeStore, type ThemeMode } from "../../store/theme.store";
import { useThemeColors } from "../../theme/useThemeColors";

const OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: "light", label: "Light", icon: "sunny-outline" },
  { mode: "dark", label: "Dark", icon: "moon-outline" },
  { mode: "system", label: "System", icon: "phone-portrait-outline" },
];

/** Segmented Light / Dark / System control. */
export function AppearanceCard() {
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <View className="gap-2">
      <Text className="px-1 text-xs font-jakarta-semibold uppercase tracking-wide text-muted">
        Appearance
      </Text>
      <View className="flex-row gap-1.5 rounded-xl border border-border bg-surface-2 p-1.5">
        {OPTIONS.map((o) => {
          const on = mode === o.mode;
          return (
            <Pressable
              key={o.mode}
              onPress={() => setMode(o.mode)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5 ${
                on ? "bg-surface" : ""
              }`}
            >
              <Ionicons name={o.icon} size={15} color={on ? colors.primary : colors.muted} />
              <Text
                className={
                  on
                    ? "text-sm font-jakarta-semibold text-primary"
                    : "text-sm font-jakarta-medium text-muted"
                }
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
