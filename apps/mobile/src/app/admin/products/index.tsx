import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { PagedList } from "../../../components/ui/PagedList";
import { Card } from "../../../components/ui/Card";
import { AdminProductService, type AdminProduct } from "../../../features/admin/services/admin.services";
import { formatPrice } from "../../../lib/utils/format";
import { colors } from "../../../theme/tokens";

export default function AdminProducts() {
  const query = useInfiniteQuery({
    queryKey: ["admin", "products-list"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => AdminProductService.getProducts({ page: pageParam, limit: 20 }),
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
  });

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell
        active="products"
        title="Products"
        right={
          <Pressable onPress={() => router.push("/admin/products/new")} hitSlop={8}>
            <Ionicons name="add-circle" size={26} color={colors.primary} />
          </Pressable>
        }
      >
        <PagedList<AdminProduct>
          query={query}
          flatten={(d) => d.pages.flatMap((p: any) => p.products ?? [])}
          keyExtractor={(p) => p.id}
          emptyIcon="cube-outline"
          emptyTitle="No products"
          renderItem={(p) => (
            <Pressable onPress={() => router.push(`/admin/products/${p.id}`)}>
              <Card className="flex-row items-center gap-3">
                <View className="h-14 w-14 overflow-hidden rounded-md bg-border">
                  {p.images?.[0]?.url ? (
                    <Image source={{ uri: p.images[0].url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : null}
                </View>
                <View className="flex-1">
                  <Text numberOfLines={1} className="font-jakarta-medium text-text">{p.name}</Text>
                  <Text className="text-xs text-muted">Stock {p.quantity} · {p.inStock ? "In stock" : "Out"}</Text>
                </View>
                <Text className="font-jakarta-bold text-text">{formatPrice(p.price)}</Text>
              </Card>
            </Pressable>
          )}
        />
      </AdminShell>
    </ScreenContainer>
  );
}
