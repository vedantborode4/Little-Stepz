import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Product } from "../../types/product";
import { isValueAvailable, type Selection } from "../../lib/variants/matrix";

const isColorAxis = (name: string) => ["color", "colour"].includes(name.trim().toLowerCase());

export function OptionSelector({
  product,
  selection,
  onSelect,
  ignoreStock,
}: {
  product: Product;
  selection: Selection;
  onSelect: (optionId: string, valueId: string) => void;
  /** Pre-order mode: every variant is out of stock, so don't grey them all out. */
  ignoreStock?: boolean;
}) {
  const options = product.options ?? [];
  if (!options.length) return null;

  return (
    <View className="gap-4">
      {options.map((opt) => {
        const color = isColorAxis(opt.name);
        const selectedLabel = opt.values.find((v) => v.id === selection[opt.id])?.value;
        return (
          <View key={opt.id} className="gap-2">
            <Text className="font-jakarta-semibold text-text">
              {opt.name}
              {selectedLabel ? <Text className="font-jakarta-medium text-muted">  {selectedLabel}</Text> : null}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {opt.values.map((val) => {
                const active = selection[opt.id] === val.id;
                const available =
                  active || isValueAvailable(product, selection, opt.id, val.id, { ignoreStock });

                if (color && val.swatchHex) {
                  return (
                    <Pressable
                      key={val.id}
                      disabled={!available}
                      onPress={() => onSelect(opt.id, val.id)}
                      className={[
                        "h-10 w-10 items-center justify-center rounded-full border-2",
                        active ? "border-primary" : "border-border",
                        !available ? "opacity-30" : "",
                      ].join(" ")}
                      style={{ backgroundColor: val.swatchHex }}
                    >
                      {active ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={val.id}
                    disabled={!available}
                    onPress={() => onSelect(opt.id, val.id)}
                    className={[
                      "rounded-md border px-4 py-2",
                      active ? "border-primary bg-primary/10" : "border-border bg-surface",
                      !available ? "opacity-30" : "",
                    ].join(" ")}
                  >
                    <Text className={active ? "font-jakarta-semibold text-primary" : "text-text"}>{val.value}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}
