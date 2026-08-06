import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";

import { colors } from "../../theme/tokens";

/**
 * Date picker field (Expo Go-safe via @react-native-community/datetimepicker).
 * Value is an ISO string; onChange(null) clears it.
 */
export function DateField({
  label,
  value,
  onChange,
  placeholder = "Select date",
}: {
  label?: string;
  value?: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;
  const valid = date && !isNaN(date.getTime());

  return (
    <View>
      {label ? <Text className="mb-1.5 text-sm font-jakarta-medium text-text">{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        className="w-full flex-row items-center justify-between rounded-lg border border-border bg-surface px-3 py-3"
      >
        <Text className={valid ? "text-base text-text" : "text-base text-muted"}>
          {valid ? format(date!, "d MMM yyyy") : placeholder}
        </Text>
        <View className="flex-row items-center gap-3">
          {valid ? (
            <Pressable onPress={() => onChange(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        </View>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={valid ? date! : new Date()}
          mode="date"
          onChange={(e, selected) => {
            setOpen(false);
            if (e.type === "set" && selected) onChange(selected.toISOString());
          }}
        />
      ) : null}
    </View>
  );
}
