import { memo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Price } from "../ui/Price";
import { getDisplayPrices, getPriceRange } from "../../lib/pricing";
import { formatPrice } from "../../lib/utils/format";
import { cldImage } from "../../lib/utils/image";
import { cardShadow } from "../../theme/shadows";
import { useWishlistStore } from "../../store/wishlist.store";
import { useCartStore } from "../../store/cart.store";
import type { Product } from "../../types/product";
import { colors } from "../../theme/tokens";

function ProductCardBase({ product }: { product: Product }) {
  const isWishlisted = useWishlistStore((s) => s.items.includes(product.id));
  const toggle = useWishlistStore((s) => s.toggle);
  const addItem = useCartStore((s) => s.addItem);
  const [adding, setAdding] = useState(false);

  // Card is a small square — request a ~400px Cloudinary thumbnail instead of
  // the full-resolution original (much faster lists, far less memory).
  const image = cldImage(product.images?.[0]?.url, { w: 400, h: 400, crop: "fill" });
  const variants = product.variants ?? [];
  const hasVariants = variants.length > 0;
  const priceRange = getPriceRange(product, variants);
  const inStock = product.inStock ?? true;
  const canPreOrder = !inStock && !!product.preOrderEnabled;

  const onAdd = async () => {
    // Out-of-stock but pre-orderable → take the user to the pre-order flow.
    if (canPreOrder) {
      router.push({ pathname: "/pre-order/[slug]", params: { slug: String(product.slug) } });
      return;
    }
    // Products with variants go to the PDP to choose (or keep the base); only
    // variant-less products add directly from the card.
    if (hasVariants) {
      router.push(`/product/${product.slug}`);
      return;
    }
    setAdding(true);
    try {
      await addItem({ productId: product.id, quantity: 1 });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/product/${product.slug}`)}
      className="h-full flex-1 overflow-hidden rounded-xl bg-surface"
      style={cardShadow}
    >
      <View className="relative aspect-square w-full bg-surface-2">
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={product.id}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Ionicons name="image-outline" size={32} color={colors.faint} />
          </View>
        )}
        <Pressable
          onPress={() => toggle(product.id)}
          hitSlop={8}
          className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-surface"
          style={cardShadow}
        >
          <Ionicons
            name={isWishlisted ? "heart" : "heart-outline"}
            size={15}
            color={isWishlisted ? colors.primary : colors.muted}
          />
        </Pressable>
        {canPreOrder ? (
          <View className="absolute left-2 top-2 rounded-full bg-warning px-2 py-0.5">
            <Text className="text-[9px] font-jakarta-bold uppercase tracking-wide text-white">Pre-Order</Text>
          </View>
        ) : null}
        {!inStock && !canPreOrder ? (
          <View className="absolute bottom-0 left-0 right-0 bg-black/60 py-1">
            <Text className="text-center text-xs font-jakarta-medium text-white">Out of stock</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-1 p-2.5">
        <Text numberOfLines={2} className="min-h-8 text-xs font-jakarta-medium leading-tight text-text">
          {product.name}
        </Text>
        <View className="mb-2 mt-0.5">
          {hasVariants && !priceRange.single ? (
            <Text className="text-sm font-jakarta-bold text-primary">From {formatPrice(priceRange.min)}</Text>
          ) : (
            <Price prices={getDisplayPrices(product)} className="text-sm text-primary" />
          )}
        </View>

        <Pressable
          onPress={onAdd}
          disabled={(!inStock && !canPreOrder) || adding}
          // Fixed height (== the previous py-2 + 16px line box), NOT padding. The
          // spinner shown while adding is taller than the label, so a content-sized
          // button grew the card — which changed the grid row's measured height and
          // made FlatList re-window, unmounting and remounting every other row.
          className={`mt-auto h-8 flex-row items-center justify-center gap-1.5 rounded-lg ${
            !inStock && !canPreOrder ? "bg-surface-3" : canPreOrder ? "bg-warning" : "bg-primary"
          }`}
        >
          {adding ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text className="text-xs font-jakarta-medium text-white">
            {canPreOrder ? "Pre-Order" : hasVariants ? "Select Options" : adding ? "Adding…" : "Add to Cart"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// Memoized: product cards fill the home rails and long grids — avoid re-rendering
// every card when an unrelated store slice (cart/wishlist) changes.
export const ProductCard = memo(ProductCardBase);
