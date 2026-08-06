import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { PromoSlot } from "../../components/home/PromoSlot";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { AddressFormSheet } from "../../components/address/AddressFormSheet";
import { useCartStore } from "../../store/cart.store";
import { useAddressStore } from "../../store/address.store";
import { useAuthStore } from "../../store/auth.store";
import { useCheckoutStore } from "../../store/checkout.store";
import type { Address } from "../../lib/services/address.service";
import { CheckoutService } from "../../lib/services/checkout.service";
import { toast } from "../../store/toast.store";
import { formatPrice } from "../../lib/utils/format";
import { getErrorMessage } from "../../lib/utils/errors";
import { getDisplayPrices } from "../../lib/pricing";
import { Price } from "../../components/ui/Price";
import { PaymentBadges } from "../../components/payments/PaymentBadges";
import { colors } from "../../theme/tokens";

interface ServerTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

const STEPS = ["Address", "Review", "Payment"];

export default function Checkout() {
  const [step, setStep] = useState(0);

  const {
    items,
    subtotal,
    discount,
    total,
    couponCode,
    isValidatingCoupon,
    fetchCart,
    revalidateCoupon,
    applyCoupon,
    removeCoupon,
  } = useCartStore();
  const { addresses, selectedAddressId, fetchAddresses, setSelectedAddress } = useAddressStore();
  const { paymentMethod, setPaymentMethod, placeOrder, placingOrder } = useCheckoutStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [serverTotals, setServerTotals] = useState<ServerTotals | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [addrSheet, setAddrSheet] = useState<{ open: boolean; editing?: Address }>({ open: false });

  const onApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) {
      toast.error("Enter a coupon code");
      return;
    }
    try {
      await applyCoupon(code);
      setCouponInput("");
      toast.success("Coupon applied 🎉");
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Invalid coupon"));
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Addresses require auth — skip for guests (they sign in at Place Order).
      if (isAuthenticated) fetchAddresses();
    }, [fetchAddresses, isAuthenticated])
  );

  useEffect(() => {
    (async () => {
      await fetchCart();
      await revalidateCoupon();
    })();
  }, [fetchCart, revalidateCoupon]);

  // Pricing lock: pull authoritative totals (incl. shipping) from the server
  // once an address is chosen. Falls back to client totals if it fails.
  useEffect(() => {
    if (!selectedAddressId || items.length === 0) {
      setServerTotals(null);
      return;
    }
    let cancelled = false;
    setCalculating(true);
    (async () => {
      try {
        const cartItems = items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId ?? undefined,
          quantity: i.quantity,
        }));
        const res: any = await CheckoutService.calculate(cartItems, selectedAddressId, couponCode || null);
        if (cancelled) return;
        const next: ServerTotals = {
          subtotal: Number(res.subtotal),
          discount: Number(res.discount),
          shipping: Number(res.shippingCharges),
          total: Number(res.total),
        };
        setServerTotals(next);
        if (Math.abs(next.subtotal - subtotal) > 0.5) {
          toast.info("Cart updated — please review your order");
        }
      } catch {
        if (!cancelled) setServerTotals(null);
      } finally {
        if (!cancelled) setCalculating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAddressId, couponCode, items, subtotal]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  const view = serverTotals ?? {
    subtotal,
    discount,
    shipping: 0,
    total: total || subtotal - discount,
  };

  const onPlaceOrder = async () => {
    if (!selectedAddressId) {
      setStep(0);
      return;
    }
    const result = await placeOrder(selectedAddressId);
    if (!result) return;
    if (result.kind === "cod") {
      router.replace({ pathname: "/checkout/success", params: { orderId: result.orderId } });
    } else {
      router.push({
        pathname: "/checkout/payment",
        params: {
          orderId: result.orderId,
          razorpayOrderId: result.rzp.razorpayOrderId,
          amount: String(result.rzp.amount),
          currency: result.rzp.currency,
          keyId: result.rzp.keyId,
        },
      });
    }
  };

  // Guest checkout: show the order summary but require sign-in to place the
  // order (client 4.3). Returns to checkout after a successful sign-in.
  if (!isAuthenticated) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <Header title="Checkout" />
        <View className="flex-1 justify-between p-4">
          <View className="gap-4">
            <Card className="gap-3">
              <Text className="text-base font-jakarta-bold text-text">Order Summary</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </Text>
                <Text className="text-sm text-text">{formatPrice(view.subtotal)}</Text>
              </View>
              {view.discount > 0 ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Discount</Text>
                  <Text className="text-sm text-success">− {formatPrice(view.discount)}</Text>
                </View>
              ) : null}
              <View className="h-px bg-border" />
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-jakarta-bold text-text">Total</Text>
                <Text className="text-lg font-jakarta-bold text-primary">{formatPrice(view.total)}</Text>
              </View>
            </Card>
            <View className="flex-row items-start gap-2 rounded-xl bg-primary/5 p-4">
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <Text className="flex-1 text-sm leading-relaxed text-muted">
                Sign in to add your delivery address and complete payment. Your cart is saved.
              </Text>
            </View>
          </View>
          <View className="gap-3">
            <PaymentBadges />
            <Button
              label="Sign In to Place Order"
              onPress={() => router.push({ pathname: "/(auth)/signin", params: { redirect: "/checkout" } })}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <Header title="Checkout" />
      <Text className="px-4 pt-1 text-xs text-muted">Complete your purchase securely</Text>

      {/* Stepper */}
      <View className="flex-row items-center justify-between px-6 py-3">
        {STEPS.map((label, i) => (
          <View key={label} className="flex-1 flex-row items-center">
            <View className={`h-7 w-7 items-center justify-center rounded-full ${i <= step ? "bg-primary" : "bg-border"}`}>
              <Text className={`text-xs font-jakarta-bold ${i <= step ? "text-white" : "text-muted"}`}>{i + 1}</Text>
            </View>
            <Text className={`ml-1.5 text-xs ${i <= step ? "font-jakarta-semibold text-text" : "text-muted"}`}>{label}</Text>
            {i < STEPS.length - 1 ? <View className={`mx-1 h-0.5 flex-1 ${i < step ? "bg-primary" : "bg-border"}`} /> : null}
          </View>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 340, gap: 12 }}
      >
        {step === 0 ? <PromoSlot position="CHECKOUT_TOP" height={110} /> : null}
        {step === 0 ? (
          <>
            {addresses.length === 0 ? (
              <Card className="items-center gap-3 py-6">
                <Ionicons name="location-outline" size={32} color={colors.muted} />
                <Text className="text-muted">No saved addresses</Text>
                <Text className="text-xs text-faint">Add an address to continue</Text>
                <Button label="Add Address" fullWidth={false} onPress={() => setAddrSheet({ open: true })} className="px-6" />
              </Card>
            ) : (
              addresses.map((a) => {
                const active = a.id === selectedAddressId;
                return (
                  <Pressable key={a.id} onPress={() => setSelectedAddress(a.id)}>
                    <Card className={active ? "border border-primary" : ""}>
                      <View className="flex-row items-start gap-2">
                        <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={20} color={active ? colors.primary : colors.muted} />
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text className="font-jakarta-semibold text-text">{a.name} · {a.phone}</Text>
                            {a.isDefault ? (
                              <View className="flex-row items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5">
                                <Ionicons name="star" size={9} color={colors.primary} />
                                <Text className="text-[9px] font-jakarta-semibold text-primary">Default</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="text-sm text-muted">{a.address}, {a.city}, {a.state} - {a.pincode}</Text>
                        </View>
                        <Pressable hitSlop={8} onPress={() => setAddrSheet({ open: true, editing: a })}>
                          <Ionicons name="create-outline" size={18} color={colors.muted} />
                        </Pressable>
                      </View>
                    </Card>
                  </Pressable>
                );
              })
            )}
            {addresses.length > 0 ? (
              <Button label="+ Add new address" variant="ghost" onPress={() => setAddrSheet({ open: true })} />
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            {items.map((it) => (
              <Card key={`${it.productId}-${it.variantId ?? "x"}`} className="flex-row items-center gap-3">
                <View className="h-14 w-14 overflow-hidden rounded-md border border-border bg-surface-2">
                  {(it.variant?.images?.[0]?.url || it.product.images?.[0]?.url) ? (
                    <Image source={{ uri: it.variant?.images?.[0]?.url || it.product.images[0].url }} style={{ width: "100%", height: "100%", padding: 4 }} contentFit="contain" />
                  ) : (
                    <View className="h-full w-full items-center justify-center">
                      <Ionicons name="image-outline" size={20} color={colors.faint} />
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <Text numberOfLines={2} className="font-jakarta-medium text-text">{it.product.name}</Text>
                  <View className="flex-row items-center gap-1">
                    <Price prices={getDisplayPrices(it.product, it.variant)} className="text-xs text-muted" />
                    <Text className="text-xs text-muted">· Qty {it.quantity}{it.variant?.name ? ` · ${it.variant.name}` : ""}</Text>
                  </View>
                </View>
                <Text className="font-jakarta-medium text-text">{formatPrice(it.subtotal)}</Text>
              </Card>
            ))}
            {selectedAddress ? (
              <Card className="gap-0.5">
                <Text className="font-jakarta-semibold text-text">Deliver to</Text>
                <Text className="text-sm text-muted">{selectedAddress.name}, {selectedAddress.address}, {selectedAddress.city}</Text>
              </Card>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            {(["COD", "ONLINE"] as const).map((m) => {
              const active = paymentMethod === m;
              return (
                <Pressable key={m} onPress={() => setPaymentMethod(m)}>
                  <Card className={active ? "border border-primary" : ""}>
                    <View className="flex-row items-center gap-3">
                      <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={20} color={active ? colors.primary : colors.muted} />
                      <View className="h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Ionicons name={m === "COD" ? "cash-outline" : "card-outline"} size={18} color={colors.primary} />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="font-jakarta-semibold text-text">
                            {m === "COD" ? "Cash on Delivery" : "Pay Online"}
                          </Text>
                          {m === "ONLINE" ? (
                            <View className="rounded-full bg-success/10 px-2 py-0.5">
                              <Text className="text-[10px] font-jakarta-semibold text-success">Instant</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text className="text-xs text-muted">
                          {m === "COD"
                            ? "Pay when your order arrives at your doorstep"
                            : "Credit/Debit card, UPI & Net Banking via Razorpay"}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
            <View className="flex-row items-center gap-1.5 px-1">
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.muted} />
              <Text className="text-xs text-muted">Secure & encrypted checkout powered by Razorpay</Text>
            </View>
          </>
        ) : null}

        {/* Order summary (review + payment steps) */}
        {step >= 1 ? (
          <Card className="gap-2">
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="font-jakarta-semibold text-text">Order Summary</Text>
              {calculating && !serverTotals ? (
                <Text className="text-[11px] text-muted">Locking latest pricing…</Text>
              ) : null}
            </View>

            {/* Coupon */}
            {couponCode ? (
              <View className="mb-1 flex-row items-center justify-between rounded-lg border border-success/40 bg-success/10 px-3 py-2">
                <View className="flex-1 flex-row items-center gap-2">
                  <Ionicons name="pricetag" size={16} color={colors.success} />
                  <View className="flex-1">
                    <Text className="font-jakarta-semibold uppercase text-success">{couponCode}</Text>
                    {view.discount > 0 ? (
                      <Text className="text-[11px] text-success">You saved {formatPrice(view.discount)}</Text>
                    ) : null}
                  </View>
                </View>
                <Pressable hitSlop={8} onPress={removeCoupon}>
                  <Ionicons name="close-circle" size={20} color={colors.muted} />
                </Pressable>
              </View>
            ) : (
              <View className="mb-1 flex-row items-center gap-2">
                <View className="flex-1 flex-row items-center rounded-lg border border-border px-3">
                  <Ionicons name="pricetag-outline" size={16} color={colors.muted} />
                  <TextInput
                    value={couponInput}
                    onChangeText={setCouponInput}
                    placeholder="Coupon code"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={onApplyCoupon}
                    className="ml-2 flex-1 py-2 font-jakarta text-text"
                  />
                </View>
                <Button label="Apply" fullWidth={false} variant="outline" loading={isValidatingCoupon} onPress={onApplyCoupon} className="px-4" />
              </View>
            )}

            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">Subtotal</Text>
              <Text className="text-sm text-text">{formatPrice(view.subtotal)}</Text>
            </View>
            {view.discount > 0 ? (
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-success">Coupon{couponCode ? ` (${couponCode})` : ""}</Text>
                <Text className="text-sm font-jakarta-medium text-success">− {formatPrice(view.discount)}</Text>
              </View>
            ) : null}
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">Shipping</Text>
              <Text className={`text-sm font-jakarta-medium ${view.shipping > 0 ? "text-text" : "text-success"}`}>
                {view.shipping > 0 ? formatPrice(view.shipping) : "Free"}
              </Text>
            </View>
            <View className="my-1 h-px bg-border" />
            <View className="flex-row items-center justify-between">
              <Text className="font-jakarta-bold text-text">Total</Text>
              <Text className="text-base font-jakarta-bold text-primary">{formatPrice(view.total)}</Text>
            </View>
            {step === 2 ? (
              <View className="mt-1 flex-row items-center justify-between rounded-lg bg-bg px-2.5 py-1.5">
                <Text className="text-xs text-muted">Payment</Text>
                <Text className="text-xs font-jakarta-semibold text-text">
                  {paymentMethod === "COD" ? "Cash on Delivery" : "Online (Razorpay)"}
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      {/* Sticky footer — sits above the system nav bar via the container's bottom safe-area edge */}
      <View style={{ paddingBottom: 12 }} className="absolute bottom-0 left-0 right-0 gap-2 border-t border-border bg-surface px-4 pt-3">
        {step === 0 && !selectedAddressId ? (
          <View className="flex-row items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2">
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text className="text-xs text-warning">Please select a delivery address to continue</Text>
          </View>
        ) : null}
        <View className="flex-row items-center justify-between">
          <Text className="text-muted">Total{couponCode ? " (coupon applied)" : ""}</Text>
          <Text className="text-lg font-jakarta-bold text-text">{formatPrice(view.total)}</Text>
        </View>
        {step === 2 ? <PaymentBadges label="" /> : null}
        {step < 2 ? (
          <Button
            label="Continue"
            disabled={step === 0 && !selectedAddressId}
            onPress={() => setStep((s) => Math.min(2, s + 1))}
          />
        ) : (
          <Button
            label={paymentMethod === "COD" ? "Place Order" : "Proceed to Pay"}
            loading={placingOrder}
            onPress={onPlaceOrder}
          />
        )}
        {step > 0 ? <Button label="Back" variant="ghost" onPress={() => setStep((s) => Math.max(0, s - 1))} /> : null}
      </View>

      <AddressFormSheet
        visible={addrSheet.open}
        editing={addrSheet.editing}
        onClose={() => setAddrSheet({ open: false })}
        onSaved={(a) => {
          // Auto-select a newly added address so the user can continue.
          if (!addrSheet.editing) setSelectedAddress(a.id);
        }}
      />
    </ScreenContainer>
  );
}
