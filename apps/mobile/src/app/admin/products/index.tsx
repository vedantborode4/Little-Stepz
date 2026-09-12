import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { PagedList } from "../../../components/ui/PagedList";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { AdminProductService, type AdminProduct } from "../../../features/admin/services/admin.services";
import { formatPrice } from "../../../lib/utils/format";
import { colors } from "../../../theme/tokens";

function ProductRow({ p }: { p: AdminProduct }) {
  return (
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
  );
}

export default function AdminProducts() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");

  // Debounced, so each keystroke doesn't fire a search request.
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const query = useInfiniteQuery({
    queryKey: ["admin", "products-list"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => AdminProductService.getProducts({ page: pageParam, limit: 20 }),
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: !term,
  });

  const results = useQuery({
    queryKey: ["admin", "products-list", "search", term],
    queryFn: () => AdminProductService.searchProducts(term),
    enabled: !!term,
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
        <View className="px-4 pt-3">
          <View className="flex-row items-center rounded-lg border border-border bg-surface px-3">
            <Ionicons name="search-outline" size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search products"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              autoCorrect={false}
              className="ml-2 flex-1 py-2.5 text-text"
            />
            {search ? (
              <Pressable onPress={() => setSearch("")} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {term ? (
          <FlatList
            data={results.data ?? []}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              results.data ? (
                <Text className="text-xs text-muted">
                  {results.data.length} {results.data.length === 1 ? "result" : "results"} for “{term}”
                </Text>
              ) : null
            }
            ListEmptyComponent={
              results.isLoading ? (
                <View className="py-16"><ActivityIndicator color={colors.primary} /></View>
              ) : results.isError ? (
                <EmptyState icon="cloud-offline-outline" title="Search failed" subtitle="Check your connection and try again." />
              ) : (
                <EmptyState icon="search-outline" title="No matching products" subtitle={`Nothing matches “${term}”.`} />
              )
            }
            renderItem={({ item }) => <ProductRow p={item} />}
          />
        ) : (
          <PagedList<AdminProduct>
            query={query}
            flatten={(d) => d.pages.flatMap((p: any) => p.products ?? [])}
            keyExtractor={(p) => p.id}
            emptyIcon="cube-outline"
            emptyTitle="No products"
            renderItem={(p) => <ProductRow p={p} />}
          />
        )}
      </AdminShell>
    </ScreenContainer>
  );
}
