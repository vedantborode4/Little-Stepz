import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ProductService } from "../../lib/services/product.service";
import { AddressService, type Address } from "../../lib/services/address.service";
import { AddressFormSheet } from "../../components/address/AddressFormSheet";
import { PreOrderService } from "../../lib/services/preorder.service";
import { getChargedPrice } from "../../lib/pricing";
import { OptionSelector } from "../../components/product/OptionSelector";
import { VariantPicker } from "../../components/product/VariantPicker";
import { findVariant, type Selection } from "../../lib/variants/matrix";
import { formatPrice } from "../../lib/utils/format";
import { toast } from "../../store/toast.store";
import { useAuthStore } from "../../store/auth.store";
import { colors } from "../../theme/tokens";
import type { Product, Variant } from "../../types/product";

// Mirrors the backend's customer shipping charge (FREE_SHIPPING) — delivery is on us.
const SHIPPING = 0;

export default function PreOrderCheckout() {
  const params = useLocalSearchParams<{ slug: string; variant?: string }>();
  const variantId = params.variant && params.variant.length ? params.variant : undefined;

  const [product, setProduct] = useState<Product | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState("");
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const idemKey = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    (async () => {
      try {
        const p = await ProductService.getBySlug(String(params.slug));
        setProduct(p);
        // Addresses need auth — skip for guests (they sign in at "Pre-Order").
        if (isAuthenticated) {
          const addr = await AddressService.getAll().catch(() => [] as Address[]);
          setAddresses(addr);
          const def = addr.find((a) => a.isDefault) || addr[0];
          if (def) setAddressId(def.id);
        }
      } catch {
        toast.error("Could not load pre-order");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.slug, isAuthenticated]);

  // The ?variant= handed over by the PDP is a hint, not a contract — the screen is
  // also reachable from a deep link whose variant may no longer exist.
  const initialVariant = useMemo(
    () => product?.variants?.find((v) => v.id === variantId) ?? null,
    [product, variantId]
  );

  const [variant, setVariant] = useState<Variant | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const hasOptions = (product?.options?.length ?? 0) > 0;
  const variants = product?.variants ?? [];

  // Seeded once the product has loaded: a variant carries only optionValueIds, so
  // the owning axis is looked up from the product's option list.
  useEffect(() => {
    if (!product || !initialVariant) return;
    setVariant(initialVariant);
    const picked = new Set(initialVariant.optionValues?.map((o) => o.optionValueId) ?? []);
    const seed: Selection = {};
    for (const opt of product.options ?? []) {
      const match = opt.values.find((v) => picked.has(v.id));
      if (match) seed[opt.id] = match.id;
    }
    setSelection(seed);
  }, [product, initialVariant]);

  const handleOptionSelect = (optionId: string, valueId: string) =>
    setSelection((prev) => {
      const next = { ...prev };
      if (next[optionId] === valueId) delete next[optionId];
      else next[optionId] = valueId;
      return next;
    });

  useEffect(() => {
    if (!product || !hasOptions) return;
    setVariant(findVariant(product, selection) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const staleVariantLink = !!variantId && !!product && !initialVariant;

  const maxQty = product?.preOrderLimit
    ? Math.max(1, product.preOrderLimit - (product.preOrderCount ?? 0))
    : 99;

  const unit = product ? getChargedPrice(product, variant) : 0;
  const booking = product?.bookingAmount != null ? Number(product.bookingAmount) : 0;
  const total = unit * quantity + SHIPPING;
  const balance = Math.max(0, total - booking);

  const confirm = async () => {
    if (!product) return;
    if (!addressId) { toast.error("Select a delivery address"); return; }
    setPlacing(true);
    try {
      const init = await PreOrderService.create({
        productId: product.id,
        variantId: variant?.id,
        quantity,
        addressId,
      }, idemKey.current);
      router.push({
        pathname: "/pre-order/payment",
        params: {
          razorpayOrderId: init.razorpayOrderId,
          amount: String(init.amount),
          currency: init.currency,
          keyId: init.keyId,
          mode: "booking",
          preOrderId: init.preOrderId,
        },
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Pre-order failed");
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <Header title="Pre-Order" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted">Loading…</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!product || !product.preOrderEnabled) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <Header title="Pre-Order" />
        <EmptyState icon="time-outline" title="Pre-order not available" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <Header title="Pre-Order" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 140 }}>
        <Card className="flex-row gap-3">
          <Image
            source={{ uri: variant?.images?.[0]?.url || product.images?.[0]?.url }}
            style={{ width: 72, height: 72, borderRadius: 10 }}
            contentFit="contain"
          />
          <View className="flex-1">
            <Text className="font-jakarta-semibold text-text">{product.name}</Text>
            {variant ? <Text className="text-xs text-muted">{variant.name}</Text> : null}
            <Text className="mt-1 text-sm text-muted">{formatPrice(unit)} each</Text>
            {product.preOrderNote ? <Text className="mt-1 text-xs text-primary">{product.preOrderNote}</Text> : null}
          </View>
          <View className="flex-row items-center self-start rounded-lg border border-border">
            <Pressable onPress={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 py-1.5"><Text className="text-muted">−</Text></Pressable>
            <Text className="px-2 text-sm font-jakarta-semibold text-text">{quantity}</Text>
            <Pressable onPress={() => setQuantity((q) => Math.min(maxQty, q + 1))} className="px-3 py-1.5"><Text className="text-muted">+</Text></Pressable>
          </View>
        </Card>

        {hasOptions || variants.length > 0 ? (
          <Card className="gap-3">
            {hasOptions ? (
              <OptionSelector
                product={product}
                selection={selection}
                onSelect={handleOptionSelect}
                ignoreStock
              />
            ) : (
              <VariantPicker
                variants={variants}
                selectedId={variant?.id}
                onSelect={(v) => setVariant((prev) => (prev?.id === v.id ? null : v))}
                onClear={() => setVariant(null)}
                ignoreStock
              />
            )}
            <View
              className={`flex-row items-start gap-2 rounded-xl border p-3 ${
                variant ? "border-primary/20 bg-primary/5" : "border-border bg-bg"
              }`}
            >
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={variant ? colors.primary : colors.muted}
              />
              <Text className="flex-1 text-xs text-muted">
                {staleVariantLink
                  ? "That link pointed at a variant we no longer offer. Pick another, or the standard version will be reserved."
                  : variant
                    ? `${variant.name} will be reserved at ${formatPrice(unit)} each.`
                    : "The standard version will be reserved."}
              </Text>
            </View>
          </Card>
        ) : null}

        <Card className="gap-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="location-outline" size={16} color={colors.text} />
              <Text className="font-jakarta-semibold text-text">Delivery address</Text>
            </View>
            {isAuthenticated ? (
              <Pressable onPress={() => setAddrSheetOpen(true)} hitSlop={8} className="flex-row items-center gap-1">
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text className="text-sm font-jakarta-medium text-primary">Add</Text>
              </Pressable>
            ) : null}
          </View>
          {!isAuthenticated ? (
            <Text className="text-sm text-muted">Sign in to add a delivery address and complete your pre-order.</Text>
          ) : addresses.length === 0 ? (
            <Text className="text-sm text-muted">No saved address yet — tap “Add” to create one.</Text>
          ) : (
            addresses.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setAddressId(a.id)}
                className={`flex-row gap-2 rounded-lg border p-2.5 ${addressId === a.id ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <Ionicons name={addressId === a.id ? "radio-button-on" : "radio-button-off"} size={18} color={addressId === a.id ? colors.primary : colors.muted} />
                <View className="flex-1">
                  <Text className="text-sm font-jakarta-medium text-text">{a.name} · {a.phone}</Text>
                  <Text className="text-xs text-muted">{a.address}, {a.city}, {a.state} {a.pincode}</Text>
                </View>
              </Pressable>
            ))
          )}
        </Card>

        <Card className="gap-1.5">
          <Row label={`Subtotal (${quantity})`} value={formatPrice(unit * quantity)} />
          <Row label="Shipping" value={SHIPPING === 0 ? "Free" : formatPrice(SHIPPING)} />
          <View className="my-1 h-px bg-border" />
          <Row label="Order total" value={formatPrice(total)} bold />
          <Row label="Pay now (booking)" value={formatPrice(booking)} highlight />
          <Row label="Balance later" value={formatPrice(balance)} />
        </Card>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-surface p-4">
        {isAuthenticated ? (
          <Button
            label={placing ? "Processing…" : `Pay ${formatPrice(booking)} & Pre-Order`}
            className="bg-primary"
            loading={placing}
            disabled={placing || !addressId}
            onPress={confirm}
          />
        ) : (
          <Button
            label="Sign In to Pre-Order"
            className="bg-primary"
            onPress={() => router.push({ pathname: "/(auth)/signin", params: { redirect: `/pre-order/${params.slug}` } })}
          />
        )}
      </View>

      <AddressFormSheet
        visible={addrSheetOpen}
        onClose={() => setAddrSheetOpen(false)}
        onSaved={async (a) => {
          const addr = await AddressService.getAll().catch(() => [] as Address[]);
          setAddresses(addr);
          setAddressId(a.id);
        }}
      />
    </ScreenContainer>
  );
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className={`text-sm ${highlight ? "text-primary" : "text-muted"}`}>{label}</Text>
      <Text className={`text-sm ${bold ? "font-jakarta-bold text-text" : highlight ? "font-jakarta-semibold text-primary" : "text-text"}`}>{value}</Text>
    </View>
  );
}
