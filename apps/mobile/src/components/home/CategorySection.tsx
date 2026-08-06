import { Dimensions, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ProductCarousel } from "../product/ProductCarousel";
import { ProductCard } from "../product/ProductCard";
import { ProductService } from "../../lib/services/product.service";
import { qk } from "../../lib/api/query-client";
import { colors } from "../../theme/tokens";

const GAP = 12;
const H_PADDING = 16;
const COL_W = (Dimensions.get("window").width - H_PADDING * 2 - GAP) / 2;

interface Props {
  slug: string;
  title: string;
  subtitle?: string;
  limit?: number;
  /** "slider" (default) = horizontal carousel · "grid" = 2-column grid. */
  layout?: "slider" | "grid";
}

/**
 * A homepage section showing one category's products.
 * Hides itself when the category has no products (mirrors the web CategorySection).
 */
export function CategorySection({ slug, title, subtitle, limit = 10, layout = "slider" }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: qk.productsByCategory(slug, { limit }),
    queryFn: () => ProductService.getByCategorySlug(slug, 1, limit),
  });

  const products = data?.data ?? [];

  // Nothing to show (or still loading) → hide the whole section.
  if (isLoading || products.length === 0) return null;

  return (
    <View className="gap-5">
      <View className="flex-row items-end justify-between gap-3 px-4">
        <View className="flex-1">
          <Text className="text-2xl font-anton uppercase tracking-wide text-primary">{title}</Text>
          {subtitle ? <Text className="mt-0.5 text-xs text-muted">{subtitle}</Text> : null}
        </View>
        <Pressable
          onPress={() => router.push({ pathname: "/category/[slug]", params: { slug } })}
          className="flex-row items-center gap-1"
        >
          <Text className="text-sm font-jakarta-medium text-primary">View All</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
        </Pressable>
      </View>

      {layout === "grid" ? (
        // Non-virtualized 2-column grid (safe inside the home ScrollView).
        <View style={{ paddingHorizontal: H_PADDING, gap: GAP }} className="flex-row flex-wrap">
          {products.map((p) => (
            <View key={p.id} style={{ width: COL_W }}>
              <ProductCard product={p} />
            </View>
          ))}
        </View>
      ) : (
        <ProductCarousel products={products} />
      )}
    </View>
  );
}
