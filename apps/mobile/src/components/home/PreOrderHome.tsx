import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ProductCarousel } from "../product/ProductCarousel";
import { SectionHeader } from "./SectionHeader";
import { qk } from "../../lib/api/query-client";
import { ProductService } from "../../lib/services/product.service";
import { colors } from "../../theme/tokens";

export function PreOrderHome() {
  const { data } = useQuery({
    queryKey: qk.products({ preOrder: true, limit: 10 }),
    queryFn: () => ProductService.getProducts({ preOrder: true, limit: 10 }),
  });

  const products = data?.data ?? [];
  if (!products.length) return null; // self-hide when nothing is pre-orderable

  return (
    <View className="gap-5">
      <SectionHeader title="Pre-Order Now" subtitle="Reserve upcoming arrivals before they sell out" />
      <ProductCarousel products={products} />
      <Pressable onPress={() => router.push("/(tabs)/preorders")} className="flex-row items-center justify-center gap-1 self-center">
        <Text className="text-base font-jakarta-medium text-primary">View All Pre-Orders</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </Pressable>
    </View>
  );
}
