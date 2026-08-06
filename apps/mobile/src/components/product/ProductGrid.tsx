import { ActivityIndicator, Dimensions, FlatList, RefreshControl, View } from "react-native";
import { ProductCard } from "./ProductCard";
import { EmptyState } from "../ui/EmptyState";
import { ProductCardSkeleton } from "../ui/Skeleton";
import { colors } from "../../theme/tokens";
import type { Product } from "../../types/product";

const { width } = Dimensions.get("window");
const COL_W = (width - 32 - 12) / 2; // 16px side padding + 12px column gap

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  isError?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
  ListHeaderComponent?: React.ReactElement;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

export function ProductGrid({
  products,
  isLoading,
  isError,
  refreshing,
  onRefresh,
  onEndReached,
  loadingMore,
  ListHeaderComponent,
  emptyTitle = "No products found",
  emptySubtitle,
  emptyActionLabel,
  onEmptyAction,
}: ProductGridProps) {
  return (
    <FlatList
      data={products}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 12, paddingHorizontal: 16, justifyContent: "flex-start" }}
      contentContainerStyle={{ gap: 12, paddingVertical: 12, flexGrow: 1 }}
      ListHeaderComponent={ListHeaderComponent}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
      onEndReachedThreshold={0.4}
      onEndReached={onEndReached}
      ListEmptyComponent={
        isLoading ? (
          <View className="flex-row flex-wrap gap-3 px-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={{ width: "47%" }}>
                <ProductCardSkeleton />
              </View>
            ))}
          </View>
        ) : isError ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn't load products" subtitle="Pull to refresh to retry." />
        ) : (
          <EmptyState
            title={emptyTitle}
            subtitle={emptySubtitle}
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
          />
        )
      }
      ListFooterComponent={
        loadingMore ? (
          <View className="py-6">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <View style={{ width: COL_W }}>
          <ProductCard product={item} />
        </View>
      )}
    />
  );
}
