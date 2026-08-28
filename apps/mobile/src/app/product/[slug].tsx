import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ProductGallery } from "../../components/product/ProductGallery";
import { VariantPicker } from "../../components/product/VariantPicker";
import { OptionSelector } from "../../components/product/OptionSelector";
import { findVariant, type Selection } from "../../lib/variants/matrix";
import { ReviewSection } from "../../components/product/ReviewSection";
import { SimilarProducts } from "../../components/product/SimilarProducts";
import { DeliveryCheck } from "../../components/product/DeliveryCheck";
import { QuantityStepper } from "../../components/ui/QuantityStepper";
import { Skeleton } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import { Rating } from "../../components/ui/Rating";
import { Price } from "../../components/ui/Price";
import { EmptyState } from "../../components/ui/EmptyState";
import { RichTextView } from "../../components/ui/RichTextView";
import { ProductService } from "../../lib/services/product.service";
import { getDisplayPrices } from "../../lib/pricing";
import { qk } from "../../lib/api/query-client";
import { useCartStore } from "../../store/cart.store";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useWishlistStore } from "../../store/wishlist.store";
import { colors } from "../../theme/tokens";
import type { Variant } from "../../types/product";

function TrustBadge({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
  return (
    <View className="flex-1 flex-row items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-3">
      <Ionicons name={icon} size={16} color={colors.primary} />
      <View>
        <Text className="text-xs font-jakarta-semibold text-text">{title}</Text>
        <Text className="text-[10px] text-muted">{subtitle}</Text>
      </View>
    </View>
  );
}

export default function ProductDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();

  const { data: product, isLoading, isError } = useQuery({
    queryKey: qk.product(slug),
    queryFn: () => ProductService.getBySlug(slug),
    enabled: !!slug,
  });

  const [variant, setVariant] = useState<Variant | undefined>(undefined);
  const [selection, setSelection] = useState<Selection>({});
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);

  const addItem = useCartStore((s) => s.addItem);
  const cartCount = useCartStore((s) => s.items.reduce((a, i) => a + i.quantity, 0));
  const isWishlisted = useWishlistStore((s) => (product ? s.items.includes(product.id) : false));
  const toggleWishlist = useWishlistStore((s) => s.toggle);

  const onShare = () => {
    if (!product) return;
    Share.share({
      message: `Check out ${product.name} on Little Stepz — https://littlestepz.in/products/${product.slug}`,
    }).catch(() => {});
  };

  const hasVariants = (product?.variants?.length ?? 0) > 0;
  const hasOptions = (product?.options?.length ?? 0) > 0;
  // Named so the "standard version" notice can tell the customer what to pick.
  const optionAxisLabel = hasOptions
    ? (product?.options ?? []).map((o) => o.name).join(" and ")
    : "a variant";

  // Structured products resolve the variant from the picked option values.
  const handleOptionSelect = (optionId: string, valueId: string) =>
    setSelection((prev) => {
      const next = { ...prev };
      if (next[optionId] === valueId) delete next[optionId];
      else next[optionId] = valueId;
      return next;
    });
  useEffect(() => {
    if (!product || !hasOptions) return;
    setVariant(findVariant(product, selection));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, product]);

  const displayPrices = useMemo(
    () => (product ? getDisplayPrices(product, variant) : null),
    [variant, product]
  );

  // Variant-aware availability (matches web): an out-of-stock selected variant counts as unavailable.
  // Variants are optional — with none selected the base product is shown and is purchasable.
  const variantOut = variant ? (variant.stock ?? 0) <= 0 : false;
  const outOfStock = product?.inStock === false || variantOut;

  // Cap the quantity at what's actually available, so the server can't reject the
  // add with a generic failure the user has no way to interpret.
  // Product stock is `quantity`; variant stock is `stock` (see the Prisma schema).
  const availableStock = variant ? variant.stock ?? 0 : product?.quantity ?? 0;
  const maxQty = availableStock > 0 ? Math.min(availableStock, 99) : 99;

  // Switching to a variant with less stock must pull the quantity down with it.
  useEffect(() => {
    setQty((q) => (q > maxQty ? maxQty : q));
  }, [maxQty]);

  const ctaDisabled = outOfStock || adding || buying;
  const canPreOrder = outOfStock && !!product?.preOrderEnabled && product?.bookingAmount != null;

  const onAdd = async () => {
    if (!product) return;
    setAdding(true);
    try {
      await addItem({ productId: product.id, variantId: variant?.id, quantity: qty });
    } finally {
      setAdding(false);
    }
  };

  const onBuyNow = async () => {
    if (!product) return;
    setBuying(true);
    try {
      // Only proceed if the item actually made it into the cart. Previously a
      // failed add still navigated, landing the user in checkout against a cart
      // that didn't contain what they were trying to buy.
      const added = await addItem({ productId: product.id, variantId: variant?.id, quantity: qty });
      if (added) router.push("/checkout");
    } finally {
      setBuying(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg">
        <Skeleton className="aspect-square w-full rounded-none" />
        <View className="gap-4 p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-24 w-full" />
        </View>
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View className="flex-1 bg-bg">
        <EmptyState icon="cloud-offline-outline" title="Product not found" actionLabel="Go back" onAction={() => router.back()} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      {/* Flipkart-style header */}
      <View style={{ paddingTop: insets.top + 6 }} className="flex-row items-center border-b border-border bg-surface px-1 pb-2.5">
        <Pressable onPress={() => router.back()} hitSlop={8} className="p-2">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text numberOfLines={1} className="flex-1 px-1 text-base font-jakarta-semibold text-text">
          {product.name}
        </Text>
        <Pressable onPress={onShare} hitSlop={8} className="p-2">
          <Ionicons name="share-social-outline" size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => toggleWishlist(product.id)} hitSlop={8} className="p-2">
          <Ionicons name={isWishlisted ? "heart" : "heart-outline"} size={22} color={isWishlisted ? colors.primary : colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push("/(tabs)/cart")} hitSlop={8} className="relative p-2">
          <Ionicons name="cart-outline" size={22} color={colors.text} />
          {cartCount > 0 ? (
            <View className="absolute right-0.5 top-0.5 min-w-4 items-center justify-center rounded-full bg-primary px-1">
              <Text className="text-[9px] font-jakarta-bold text-white">{cartCount > 99 ? "99+" : cartCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* keyboardShouldPersistTaps: the pincode "Check" and review "Submit" buttons
          live in this scroll view — without it the first tap only dismisses the
          keyboard and the button has to be pressed twice. */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* No `key` — the gallery resets its own pager when the image set changes,
            so switching variants swaps the picture instead of remounting. */}
        <ProductGallery images={variant?.images?.length ? variant.images : product.images} />

        <View className="gap-5 p-4">
          {/* Header: category badge + name */}
          <View className="gap-2">
            {product.category?.name ? (
              <View className="self-start rounded-full bg-primary/10 px-2.5 py-1">
                <Text className="text-xs font-jakarta-semibold uppercase tracking-wide text-primary">
                  {product.category.name}
                </Text>
              </View>
            ) : null}
            <Text className="text-2xl font-jakarta-bold leading-tight text-text">{product.name}</Text>
          </View>

          {/* Price + 3-state stock badge (In Stock / Pre-Order / Out of Stock) */}
          <View className="flex-row items-center gap-3">
            {displayPrices ? <Price prices={displayPrices} size="lg" className="text-3xl" /> : null}
            {canPreOrder ? (
              <View className="rounded-full bg-warning/10 px-2.5 py-1">
                <Text className="text-xs font-jakarta-semibold text-warning">● Pre-Order</Text>
              </View>
            ) : (
              <View className={`rounded-full px-2.5 py-1 ${outOfStock ? "bg-danger/10" : "bg-success/10"}`}>
                <Text className={`text-xs font-jakarta-semibold ${outOfStock ? "text-danger" : "text-success"}`}>
                  {outOfStock ? "● Out of Stock" : "● In Stock"}
                </Text>
              </View>
            )}
          </View>

          {/* Pre-order info banner */}
          {canPreOrder ? (
            <View className="gap-1 rounded-xl border border-warning/30 bg-warning/10 p-3">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="time-outline" size={15} color={colors.warning} />
                <Text className="text-sm font-jakarta-semibold text-warning">Available for Pre-Order</Text>
              </View>
              <Text className="text-xs text-muted">
                {`Reserve now by paying a booking amount of ₹${Number(product.bookingAmount).toLocaleString("en-IN")}. Pay the balance when it's back in stock.`}
              </Text>
              {product.preOrderNote ? (
                <Text className="text-xs text-muted">{product.preOrderNote}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Rating */}
          {typeof product.rating === "number" && product.rating > 0 ? (
            <Rating value={product.rating} count={product.reviewCount} size={16} />
          ) : null}

          {hasOptions ? (
            <View className="gap-2">
              {Object.keys(selection).length > 0 ? (
                <Pressable onPress={() => setSelection({})} hitSlop={8} className="self-end">
                  <Text className="text-xs font-jakarta-semibold text-primary">Clear · show base</Text>
                </Pressable>
              ) : null}
              <OptionSelector
                product={product}
                selection={selection}
                onSelect={handleOptionSelect}
                ignoreStock={canPreOrder}
              />
            </View>
          ) : hasVariants ? (
            <VariantPicker
              variants={product.variants!}
              selectedId={variant?.id}
              onSelect={(v) => setVariant((prev) => (prev?.id === v.id ? undefined : v))}
              onClear={() => setVariant(undefined)}
              ignoreStock={canPreOrder}
            />
          ) : null}

          {/* What's actually going in the cart — the base product is a real, buyable
              SKU, so an empty selection must not look like nothing happened. */}
          {(hasOptions || hasVariants) ? (
            <View
              className={`flex-row items-start gap-2.5 rounded-xl border p-3.5 ${
                variant ? "border-primary/20 bg-primary/5" : "border-border bg-surface-2"
              }`}
            >
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={variant ? colors.primary : colors.muted}
                style={{ marginTop: 1 }}
              />
              <Text className="flex-1 text-xs text-muted">
                {variant ? (
                  <>
                    <Text className="font-jakarta-semibold text-text">{variant.name}</Text> selected.
                  </>
                ) : (
                  <>
                    <Text className="font-jakarta-semibold text-text">Standard version</Text>
                    {` — pick ${optionAxisLabel} above to choose a specific one.`}
                  </>
                )}
              </Text>
            </View>
          ) : null}

          {/* Quantity */}
          <View className="flex-row items-center gap-4">
            <Text className="font-jakarta-semibold text-text">Quantity</Text>
            <QuantityStepper value={qty} onChange={setQty} max={maxQty} />
          </View>

          {/* Trust badges */}
          <View className="flex-row gap-3">
            <TrustBadge icon="cube-outline" title="Free Delivery" subtitle="On all orders" />
            <TrustBadge icon="shield-checkmark-outline" title="Easy Returns" subtitle="7-day return policy" />
          </View>

          {/* Description */}
          {product.description ? (
            <View className="rounded-xl border border-border bg-surface p-4">
              <Text className="mb-2 font-jakarta-semibold text-text">About this product</Text>
              <Text className="text-sm leading-relaxed text-muted">{product.description}</Text>
            </View>
          ) : null}

          {/* Authenticity trust row → policy page (client 5.8) */}
          <Pressable
            onPress={() => router.push("/legal/authenticity")}
            className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-jakarta-semibold text-text">100% Authentic · Unboxing proof</Text>
              <Text className="text-xs text-muted">Genuine products, quality-checked before dispatch.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          {/* Delivery / pincode serviceability check (parity with web) */}
          <DeliveryCheck />

          {/* Specifications */}
          {Array.isArray(product.specifications) && product.specifications.length > 0 ? (
            <View className="rounded-xl border border-border bg-surface p-4">
              <Text className="mb-2 font-jakarta-semibold text-text">Specifications</Text>
              {product.specifications.map((spec, i) => (
                <View
                  key={i}
                  className={`flex-row gap-3 py-2 ${i < product.specifications!.length - 1 ? "border-b border-border" : ""}`}
                >
                  <Text className="w-2/5 text-sm font-jakarta-medium text-muted">{spec.label}</Text>
                  <Text className="flex-1 text-sm text-text">{spec.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Long description (formatted) */}
          {product.longDescription ? (
            <View className="rounded-xl border border-border bg-surface p-4">
              <Text className="mb-1 font-jakarta-semibold text-text">Product Details</Text>
              <RichTextView html={product.longDescription} />
            </View>
          ) : null}

          <ReviewSection productId={product.id} />

          <SimilarProducts categoryId={product.category?.id} excludeId={product.id} />
        </View>
      </ScrollView>

      {/* Sticky CTA bar — extra bottom padding so it clears the system nav bar */}
      <View
        // Shared floor, so Add to Cart / Buy Now clears a 3-button nav bar too.
        style={{ paddingBottom: bottomInset + 12 }}
        className="absolute bottom-0 left-0 right-0 flex-row gap-2.5 border-t border-border bg-surface px-4 pt-3"
      >
        {canPreOrder ? (
          <View className="flex-1">
            <Button
              label={`Pre-Order · ₹${Number(product!.bookingAmount).toLocaleString("en-IN")}`}
              className="bg-primary"
              onPress={() =>
                router.push({
                  pathname: "/pre-order/[slug]",
                  params: { slug: String(product!.slug), variant: variant?.id ?? "" },
                })
              }
              left={<Ionicons name="time-outline" size={16} color="#fff" />}
            />
          </View>
        ) : outOfStock ? (
          // One honest dead button. A disabled "Out of Stock" sitting next to a
          // disabled "Buy Now" reads as a glitch rather than a stock state.
          <View className="flex-1">
            <Button label="Out of Stock" variant="outline" disabled onPress={() => {}} />
          </View>
        ) : (
          <>
            <View className="flex-1">
              <Button
                label="Add to Cart"
                variant="outline"
                className="border-primary"
                disabled={ctaDisabled}
                loading={adding}
                onPress={onAdd}
                left={<Ionicons name="cart-outline" size={18} color={colors.primary} />}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Buy Now"
                disabled={ctaDisabled}
                loading={buying}
                onPress={onBuyNow}
                left={<Ionicons name="flash" size={16} color="#fff" />}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}
