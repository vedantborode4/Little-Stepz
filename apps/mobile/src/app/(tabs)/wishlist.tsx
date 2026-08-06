import { useMemo } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AppHeader } from "../../components/layout/AppHeader";
import { ProductGrid } from "../../components/product/ProductGrid";
import { EmptyState } from "../../components/ui/EmptyState";
import { WishlistService } from "../../lib/services/wishlist.service";
import { qk } from "../../lib/api/query-client";
import { useAuthStore } from "../../store/auth.store";
import { useWishlistStore } from "../../store/wishlist.store";
import type { Product } from "../../types/product";

export default function Wishlist() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // re-render when local wishlist ids change (heart toggles)
  useWishlistStore((s) => s.items);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: qk.wishlist,
    queryFn: () => WishlistService.getWishlist(),
    enabled: isAuthenticated,
  });

  const products = useMemo<Product[]>(
    () =>
      (data?.items ?? []).map((i) => ({
        id: i.product.id,
        name: i.product.name,
        slug: i.product.slug,
        price: i.product.price,
        salePrice: i.product.salePrice,
        isOnSale: i.product.isOnSale,
        priceDisplay: i.product.priceDisplay,
        images: i.product.images ?? [],
      })),
    [data]
  );

  if (!isAuthenticated) {
    return (
      <ScreenContainer>
        <AppHeader />
        <EmptyState
          icon="heart-outline"
          title="Sign in to view your wishlist"
          subtitle="Save your favourites and find them here."
          actionLabel="Sign In"
          onAction={() => router.push("/(auth)/signin")}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader />
      <ProductGrid
        products={products}
        isLoading={isLoading}
        isError={isError}
        refreshing={isRefetching}
        onRefresh={() => refetch()}
        ListHeaderComponent={
          <Text className="px-4 pb-1 pt-2 text-xs text-muted">
            {products.length} {products.length === 1 ? "item" : "items"} saved
          </Text>
        }
        emptyTitle="No saved items"
        emptySubtitle="Tap the heart on any product to save it."
      />
    </ScreenContainer>
  );
}
