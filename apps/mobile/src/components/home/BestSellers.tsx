import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { ProductCarousel } from "../product/ProductCarousel";
import { EmptyState } from "../ui/EmptyState";
import { qk } from "../../lib/api/query-client";
import { ProductService } from "../../lib/services/product.service";
import { colors } from "../../theme/tokens";

export function BestSellers({ sort = "newest", limit = 10 }: { sort?: string; limit?: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: qk.products({ sort, limit }),
    queryFn: () => ProductService.getProducts({ sort, limit }),
  });

  const products = (data?.data ?? []).slice(0, limit);

  if (isLoading) {
    return (
      <View className="py-10">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load products"
        subtitle="Check your connection and pull to refresh."
      />
    );
  }

  if (!products.length) {
    return <EmptyState title="No products yet" subtitle="Check back soon." />;
  }

  return (
    <View>
      <ProductCarousel products={products} />

      <Pressable onPress={() => router.push("/search")} className="mt-5 self-center">
        <Text className="text-base font-jakarta-medium text-primary">View All →</Text>
      </Pressable>
    </View>
  );
}
