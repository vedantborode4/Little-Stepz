import { useEffect, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { CartLineItem } from "../../components/cart/CartLineItem";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useCartStore } from "../../store/cart.store";
import { formatPrice } from "../../lib/utils/format";
import { getErrorMessage } from "../../lib/utils/errors";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

export default function Cart() {
  const {
    items, subtotal, discount, total, couponCode, isValidatingCoupon, isLoading,
    fetchCart, updateQuantity, removeItem, applyCoupon, removeCoupon, updatingKey,
  } = useCartStore();
  const [code, setCode] = useState("");
  // The summary bar floats over the list; measure it so the last item can always
  // scroll clear of it (its height changes with the coupon/discount rows).
  const [summaryHeight, setSummaryHeight] = useState(240);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const onApply = async () => {
    if (!code.trim()) {
      toast.error("Enter a coupon code");
      return;
    }
    try {
      await applyCoupon(code);
      toast.success("Coupon applied 🎉");
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Invalid coupon"));
    }
  };

  // Guest checkout: open the checkout page for everyone. Sign-in is only
  // required at the "Place Order" step (client 4.3).
  const onCheckout = () => {
    router.push("/checkout");
  };

  // Show a skeleton on the initial load instead of a false "empty cart" flash.
  if (isLoading && items.length === 0) {
    return (
      <ScreenContainer>
        <View className="gap-3 p-4">
          {[0, 1, 2].map((i) => (
            <View key={i} className="flex-row gap-3 rounded-xl border border-border bg-surface p-3">
              <Skeleton className="h-20 w-20 rounded-lg" />
              <View className="flex-1 gap-2 py-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-6 w-24 rounded-lg" />
              </View>
            </View>
          ))}
        </View>
      </ScreenContainer>
    );
  }

  if (items.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          subtitle="Browse products and add your favourites."
          actionLabel="Start shopping"
          onAction={() => router.push("/(tabs)/search")}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="flex-row items-center gap-3 border-b border-border bg-bg px-4 py-3">
        <View className="rounded-xl bg-primary/10 p-2.5">
          <Ionicons name="bag-handle-outline" size={18} color={colors.primary} />
        </View>
        <View>
          <Text className="text-lg font-jakarta-bold text-text">Shopping Cart</Text>
          <Text className="text-xs text-muted">
            {items.length} {items.length === 1 ? "item" : "items"} in your cart
          </Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => `${i.productId}-${i.variantId ?? "x"}`}
        contentContainerStyle={{ paddingBottom: summaryHeight + 16 }}
        renderItem={({ item }) => (
          <CartLineItem
            item={item}
            busy={updatingKey === `${item.productId}-${item.variantId ?? "no-variant"}`}
            onChangeQty={(q) => updateQuantity(item.productId, item.variantId ?? undefined, q)}
            onRemove={() => removeItem(item.productId, item.variantId ?? undefined)}
          />
        )}
      />

      <View
        onLayout={(e) => setSummaryHeight(e.nativeEvent.layout.height)}
        // No safe-area inset here — this bar sits inside the tab screen, and the
        // tab bar below it already covers the device's bottom inset.
        style={{ paddingBottom: 10 }}
        className="absolute bottom-0 left-0 right-0 gap-3 border-t border-border bg-surface px-4 pt-3"
      >
        {couponCode ? (
          <View className="flex-row items-center justify-between rounded-lg border border-success/40 bg-success/10 px-3 py-2">
            <View className="flex-1 flex-row items-center gap-2">
              <Ionicons name="pricetag" size={16} color={colors.success} />
              <View className="flex-1">
                <Text className="font-jakarta-semibold uppercase text-success">{couponCode}</Text>
                {discount > 0 ? <Text className="text-[11px] text-success">You saved {formatPrice(discount)}</Text> : null}
              </View>
            </View>
            <Button label="Remove" variant="outline" fullWidth={false} onPress={() => { removeCoupon(); setCode(""); }} className="px-3" />
          </View>
        ) : (
          <View className="flex-row gap-2">
            <View className="flex-1 flex-row items-center rounded-lg border border-border bg-surface px-3">
              <Ionicons name="pricetag-outline" size={16} color={colors.muted} />
              <TextInput
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                placeholder="Coupon code"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                onSubmitEditing={onApply}
                className="flex-1 px-2 py-2.5 text-text"
              />
            </View>
            <Button label="Apply" fullWidth={false} loading={isValidatingCoupon} onPress={onApply} className="px-5" />
          </View>
        )}

        <View className="gap-1">
          <Row label={`Subtotal (${items.length} ${items.length === 1 ? "item" : "items"})`} value={formatPrice(subtotal)} />
          {discount > 0 ? <Row label={`Coupon (${couponCode})`} value={`− ${formatPrice(discount)}`} highlight /> : null}
          <Row label="Shipping" value="Free" highlight />
          <View className="my-1 h-px bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-jakarta-bold text-text">Total</Text>
            <Text className="text-lg font-jakarta-bold text-primary">{formatPrice(total)}</Text>
          </View>
        </View>

        <Button label="Proceed to Checkout" onPress={onCheckout} />
        <Text className="text-center text-[11px] text-muted">Secure checkout powered by Razorpay</Text>
      </View>
    </ScreenContainer>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className={highlight ? "text-sm font-jakarta-medium text-success" : "text-sm text-text"}>{value}</Text>
    </View>
  );
}
