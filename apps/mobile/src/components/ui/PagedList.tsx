import { ActivityIndicator, FlatList, View } from "react-native";
import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import { EmptyState } from "./EmptyState";
import { colors } from "../../theme/tokens";

interface PagedListProps<T> {
  query: UseInfiniteQueryResult<any, any>;
  flatten: (data: any) => T[];
  renderItem: (item: T) => React.ReactElement;
  keyExtractor: (item: T, index: number) => string;
  emptyTitle?: string;
  emptyIcon?: any;
  header?: React.ReactElement;
}

export function PagedList<T>({
  query,
  flatten,
  renderItem,
  keyExtractor,
  emptyTitle = "Nothing here yet",
  emptyIcon = "documents-outline",
  header,
}: PagedListProps<T>) {
  const items: T[] = query.data?.pages ? flatten(query.data) : [];

  return (
    <FlatList
      data={items}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => query.refetch()}
      onEndReachedThreshold={0.4}
      onEndReached={() => query.hasNextPage && query.fetchNextPage()}
      ListEmptyComponent={
        query.isLoading ? (
          <View className="py-16">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <EmptyState icon={emptyIcon} title={emptyTitle} />
        )
      }
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <View className="py-4">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null
      }
      renderItem={({ item }) => renderItem(item)}
    />
  );
}
