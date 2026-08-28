import { Pressable, Text, View } from "react-native";
import type { Variant } from "../../types/product";
import { isVariantSelectable, type StockMode } from "../../lib/variants/matrix";

interface VariantPickerProps {
  variants: Variant[];
  selectedId?: string;
  onSelect: (variant: Variant) => void;
  onClear?: () => void;
  /** Which variants count as selectable — see StockMode. */
  stockMode?: StockMode;
  /** Booking amount per variant, keyed by id — rendered on the chip when present. */
  bookingAmounts?: Record<string, number | null>;
}

export function VariantPicker({ variants, selectedId, onSelect, onClear, stockMode, bookingAmounts }: VariantPickerProps) {
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
          const out = !isVariantSelectable(v, stockMode);
          const booking = bookingAmounts?.[v.id];
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
              <Text className={active ? "font-jakarta-semibold text-primary" : "text-text"}>
                {v.name}
                {!out && booking != null ? (
                  <Text className="text-xs text-muted">{`  ₹${booking.toLocaleString("en-IN")}`}</Text>
                ) : null}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
