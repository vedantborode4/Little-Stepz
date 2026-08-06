import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet } from "./Sheet";
import { colors } from "../../theme/tokens";

export interface Option {
  label: string;
  value: string;
}

interface SelectSheetProps {
  label?: string;
  placeholder?: string;
  value?: string | null;
  options: Option[];
  onChange: (value: string) => void;
}

export function SelectSheet({ label, placeholder = "Select", value, options, onChange }: SelectSheetProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View className="w-full">
      {label ? <Text className="mb-1.5 text-sm font-jakarta-medium text-text">{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-lg border border-border bg-surface px-3 py-3"
      >
        <Text className={selected ? "text-text" : "text-muted"}>{selected?.label ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? "Select"}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex-row items-center justify-between py-3"
            >
              <Text className={on ? "font-jakarta-semibold text-primary" : "text-text"}>{o.label}</Text>
              {on ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </Sheet>
    </View>
  );
}
