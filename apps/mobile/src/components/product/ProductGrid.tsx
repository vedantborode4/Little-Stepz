import { memo } from "react";
import { ActivityIndicator, Dimensions, FlatList, RefreshControl, View } from "react-native";
import { CARD_BODY_H, ProductCard } from "./ProductCard";
import { EmptyState } from "../ui/EmptyState";
import { ProductCardSkeleton } from "../ui/Skeleton";
import { colors } from "../../theme/tokens";
import type { Product } from "../../types/product";

const { width } = Dimensions.get("window");
const GAP = 12;
// Rounded so the measured cell matches getItemLayout to the pixel.
const COL_W = Math.round((width - 32 - GAP) / 2); // 16px side padding + column gap
// A card is a square image plus a fixed-height body, so every row is identical.
const CARD_H = COL_W + CARD_BODY_H;
const ROW_H = CARD_H + GAP; // card + the row's bottom margin
const FOOTER_H = 48;

const CONTENT_STYLE = { paddingTop: GAP, paddingBottom: 16 };
const EMPTY_CONTENT_STYLE = { ...CONTENT_STYLE, flexGrow: 1 };
const COLUMN_STYLE = {
  gap: GAP,
  paddingHorizontal: 16,
  justifyContent: "flex-start" as const,
  marginBottom: GAP,
};

const keyExtractor = (p: Product) => p.id;

// Module scope: a new function identity on every render would defeat FlatList's
// cell memoization.
const renderProduct = ({ item }: { item: Product }) => (
  <View style={{ width: COL_W, height: CARD_H }}>
    <ProductCard product={item} />
  </View>
);

// numColumns > 1 means FlatList feeds VirtualizedList *row* indices, so this is
// per row, not per product.
const getItemLayout = (_: unknown, index: number) => ({
  length: ROW_H,
  offset: ROW_H * index,
  index,
});

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  isError?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
  /** Reserves the footer space up front so loading a page doesn't shift the list. */
  hasMore?: boolean;
  ListHeaderComponent?: React.ReactElement;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

function ProductGridBase({
  products,
  isLoading,
  isError,
  refreshing,
  onRefresh,
  onEndReached,
  loadingMore,
  hasMore,
  ListHeaderComponent,
  emptyTitle = "No products found",
  emptySubtitle,
  emptyActionLabel,
  onEmptyAction,
}: ProductGridProps) {
  const showFooter = products.length > 0 && (loadingMore || hasMore);

  return (
    <FlatList
      data={products}
      keyExtractor={keyExtractor}
      numColumns={2}
      columnWrapperStyle={COLUMN_STYLE}
      contentContainerStyle={products.length === 0 ? EMPTY_CONTENT_STYLE : CONTENT_STYLE}
      // Exact geometry: every row is ROW_H tall, so the list never has to guess
      // where a cell starts. Guessing is what left blank bands between rows.
      getItemLayout={getItemLayout}
      // Defaults to true on Android, which unmounts off-screen cells and — paired
      // with expo-image's fade-in — made cards flicker and sometimes stay blank.
      removeClippedSubviews={false}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={11}
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
          // Same column width and card height as the real cells, so the
          // skeleton → data swap doesn't shift anything.
          <View className="flex-row flex-wrap px-4" style={{ gap: GAP }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={{ width: COL_W, height: CARD_H }}>
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
        showFooter ? (
          <View className="items-center justify-center" style={{ height: FOOTER_H }}>
            {loadingMore ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
        ) : null
      }
      renderItem={renderProduct}
    />
  );
}

// Memoized: the parent listing re-renders on every keystroke in its search box,
// and re-rendering the grid recreates the header/footer/refresh elements, which
// forces FlatList to re-render (and flicker) for no reason.
export const ProductGrid = memo(ProductGridBase);
