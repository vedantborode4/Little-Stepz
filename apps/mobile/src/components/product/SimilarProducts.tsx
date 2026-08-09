import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ProductCarousel } from "./ProductCarousel";
import { ProductService } from "../../lib/services/product.service";
import { colors } from "../../theme/tokens";

export function SimilarProducts({ categoryId, excludeId }: { categoryId?: string; excludeId?: string }) {
  const { data } = useQuery({
    queryKey: ["products", "similar", categoryId],
    queryFn: () => ProductService.getProducts({ category: categoryId, limit: 10 }),
    enabled: !!categoryId,
  });

  const products = (data?.data ?? []).filter((p) => p.id !== excludeId).slice(0, 8);
  if (!products.length) return null;

  return (
    // -mx-4 cancels the PDP's p-4 so the carousel runs full-bleed like the home sliders.
    <View className="-mx-4 gap-4">
      <View className="flex-row items-center gap-3 px-4">
        <View className="rounded-xl bg-primary/10 p-2">
          <Ionicons name="sparkles" size={16} color={colors.primary} />
        </View>
        <View>
          <Text className="text-xl font-anton uppercase tracking-wide text-text">You May Also Like</Text>
          <Text className="text-xs text-muted">From the same category</Text>
        </View>
      </View>

      <ProductCarousel products={products} />
    </View>
  );
}
