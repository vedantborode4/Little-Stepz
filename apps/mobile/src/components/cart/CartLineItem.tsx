import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { QuantityStepper } from "../ui/QuantityStepper";
import { Price } from "../ui/Price";
import { formatPrice } from "../../lib/utils/format";
import { getChargedPrice, getDisplayPrices } from "../../lib/pricing";
import { colors } from "../../theme/tokens";
import type { CartItem } from "../../types/cart";

interface Props {
  item: CartItem;
  onChangeQty: (qty: number) => void;
  onRemove: () => void;
  busy?: boolean;
}

export function CartLineItem({ item, onChangeQty, onRemove, busy }: Props) {
  const image = item.variant?.images?.[0]?.url ?? item.product.images?.[0]?.url;
  const unitPrice = getChargedPrice(item.product, item.variant);
  const unitPrices = getDisplayPrices(item.product, item.variant);

  return (
    <View className={`flex-row gap-3 border-b border-border bg-surface p-4 ${busy ? "opacity-50" : ""}`}>
      <Pressable
        onPress={() => item.product.slug && router.push(`/product/${item.product.slug}`)}
        className="h-[84px] w-[84px] overflow-hidden rounded-xl border border-border bg-surface"
      >
        {image ? (
          <Image source={{ uri: image }} style={{ width: "100%", height: "100%", padding: 8 }} contentFit="contain" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Ionicons name="image-outline" size={24} color={colors.faint} />
          </View>
        )}
      </Pressable>

      <View className="flex-1 justify-between">
        <View className="flex-row items-start justify-between">
          <Text numberOfLines={2} className="mr-2 flex-1 text-sm font-jakarta-semibold leading-snug text-text">
            {item.product.name}
          </Text>
          <Pressable onPress={onRemove} hitSlop={8} disabled={busy}>
            <Ionicons name="trash-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>

        {item.variant?.name ? (
          <View className="mt-1.5 self-start rounded-md bg-surface-2 px-2 py-0.5">
            <Text className="text-[10px] font-jakarta-semibold uppercase tracking-wide text-muted">
              {item.variant.name}
            </Text>
          </View>
        ) : null}

        <View className="mt-1.5 flex-row items-center gap-1">
          <Price prices={unitPrices} className="text-xs text-muted" />
          <Text className="text-xs font-jakarta-medium text-muted">each</Text>
        </View>

        <View className="mt-2 flex-row items-end justify-between">
          <QuantityStepper value={item.quantity} onChange={onChangeQty} disabled={busy} />
          <View className="items-end">
            <Price value={item.subtotal} className="text-base" />
            {item.quantity > 1 ? (
              <Text className="mt-0.5 text-[11px] text-muted">
                {item.quantity} × {formatPrice(unitPrice)}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
