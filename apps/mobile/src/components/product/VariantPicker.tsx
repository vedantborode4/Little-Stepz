import { Pressable, Text, View } from "react-native";
import type { Variant } from "../../types/product";

interface VariantPickerProps {
  variants: Variant[];
  selectedId?: string;
  onSelect: (variant: Variant) => void;
  onClear?: () => void;
}

export function VariantPicker({ variants, selectedId, onSelect, onClear }: VariantPickerProps) {
  if (!variants?.length) return null;
  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="font-jakarta-semibold text-text">Options</Text>
        {selectedId && onClear ? (
          <Pressable onPress={onClear} hitSlop={8}>
            <Text className="text-xs font-jakarta-semibold text-primary">Clear · show base</Text>
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {variants.map((v) => {
          const active = v.id === selectedId;
          const out = v.inStock === false || v.stock === 0;
          return (
            <Pressable
              key={v.id}
              disabled={out}
              onPress={() => onSelect(v)}
              className={[
                "rounded-md border px-4 py-2",
                active ? "border-primary bg-primary/10" : "border-border bg-surface",
                out ? "opacity-40" : "",
              ].join(" ")}
            >
              <Text className={active ? "font-jakarta-semibold text-primary" : "text-text"}>{v.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
