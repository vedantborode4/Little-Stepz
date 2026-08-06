import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { ProductGrid } from "../../components/product/ProductGrid";
import { PromoSlot } from "../../components/home/PromoSlot";
import { Sheet } from "../../components/ui/Sheet";
import { useCartStore } from "../../store/cart.store";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useProducts } from "../../hooks/useProducts";
import type { SortOption } from "../../store/productFilter.store";
import { colors } from "../../theme/tokens";

const SORTS: { key: SortOption; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
  { key: "name_asc", label: "Name: A–Z" },
  { key: "name_desc", label: "Name: Z–A" },
];

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const cartCount = useCartStore((s) => s.items.reduce((a, i) => a + i.quantity, 0));

  const [sort, setSort] = useState<SortOption>("newest");
  const [priceMin, setPriceMin] = useState<number | undefined>();
  const [priceMax, setPriceMax] = useState<number | undefined>();
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");

  const query = useProducts({ category: slug, sort, priceMin, priceMax });

  const products = useMemo(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data]
  );

  const title = slug
    ? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Category";

  const hasActiveFilters = priceMin != null || priceMax != null;

  const applyPrice = () => {
    setPriceMin(minInput ? Number(minInput) : undefined);
    setPriceMax(maxInput ? Number(maxInput) : undefined);
    setFilterOpen(false);
  };

  return (
    <ScreenContainer>
      {/* Back + breadcrumbs */}
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push("/(tabs)/home")}>
          <Text className="text-xs text-muted">Home</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={12} color={colors.muted} />
        <Text numberOfLines={1} className="flex-1 text-xs font-jakarta-medium text-text">{title}</Text>
        <Pressable onPress={() => router.push("/(tabs)/cart")} hitSlop={8} className="relative p-1.5">
          <Ionicons name="cart-outline" size={22} color={colors.text} />
          {cartCount > 0 ? (
            <View className="absolute right-0 top-0 min-w-4 items-center justify-center rounded-full bg-primary px-1">
              <Text className="text-[9px] font-jakarta-bold text-white">{cartCount > 9 ? "9+" : cartCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Sort / Filter */}
      <View className="flex-row gap-2 px-4 pb-2">
        <Pressable
          onPress={() => setSortOpen(true)}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-md border border-border bg-surface py-2.5"
        >
          <Ionicons name="swap-vertical" size={16} color={colors.text} />
          <Text className="font-jakarta-medium text-text">Sort</Text>
        </Pressable>
        <Pressable
          onPress={() => setFilterOpen(true)}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-md border border-border bg-surface py-2.5"
        >
          <Ionicons name="options-outline" size={16} color={colors.text} />
          <Text className="font-jakarta-medium text-text">Filter</Text>
          {hasActiveFilters ? <View className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
        </Pressable>
      </View>

      <ProductGrid
        products={products}
        isLoading={query.isLoading}
        isError={query.isError}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => query.refetch()}
        onEndReached={() => query.hasNextPage && query.fetchNextPage()}
        loadingMore={query.isFetchingNextPage}
        ListHeaderComponent={
          <View className="gap-3">
            <PromoSlot position="CATEGORY_TOP" />
            <Text className="px-4 pb-2 text-center text-2xl font-jakarta-bold text-primary">{title}</Text>
          </View>
        }
        emptyTitle="No products in this category"
        emptySubtitle="Browse our full range instead."
        emptyActionLabel="View all products"
        onEmptyAction={() => router.push("/search")}
      />

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        {SORTS.map((s) => {
          const active = sort === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => {
                setSort(s.key);
                setSortOpen(false);
              }}
              className="flex-row items-center justify-between py-3"
            >
              <Text className={active ? "font-jakarta-semibold text-primary" : "text-text"}>{s.label}</Text>
              {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </Sheet>

      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter">
        <Text className="mb-2 font-jakarta-medium text-text">Price range (₹)</Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input placeholder="Min" keyboardType="numeric" value={minInput} onChangeText={setMinInput} />
          </View>
          <View className="flex-1">
            <Input placeholder="Max" keyboardType="numeric" value={maxInput} onChangeText={setMaxInput} />
          </View>
        </View>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Button
              label="Clear"
              variant="outline"
              onPress={() => {
                setMinInput("");
                setMaxInput("");
                setPriceMin(undefined);
                setPriceMax(undefined);
                setFilterOpen(false);
              }}
            />
          </View>
          <View className="flex-1">
            <Button label="Apply" onPress={applyPrice} />
          </View>
        </View>
      </Sheet>
    </ScreenContainer>
  );
}
