import { useMemo } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { OrderCard } from "../../components/order/OrderCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { OrderService } from "../../lib/services/order.service";
import { qk } from "../../lib/api/query-client";
import { colors } from "../../theme/tokens";
import type { Order } from "../../types/order";

const PAGE_SIZE = 20;

export default function Orders() {
  // Paged: the endpoint returns 20 orders by default, so a single fetch silently hid
  // every order older than that. The key sits under `qk.orders`, so the invalidations
  // elsewhere (cancel, return) still refresh this list.
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [...qk.orders, "pages"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => OrderService.getPage(pageParam, PAGE_SIZE),
    getNextPageParam: (last) => (last && last.page < last.pages ? last.page + 1 : undefined),
  });

  const orders = useMemo<Order[]>(() => {
    const raw: Order[] = data?.pages.flatMap((p) => p?.orders ?? []) ?? [];
    // Dedupe by id: a new order placed between page fetches shifts the pages by one.
    const seen = new Set<string>();
    return raw.filter((o) => {
      if (!o?.id || seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
  }, [data]);

  return (
    <ScreenContainer>
      <Header title="My Orders" />
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshing={isRefetching && !isFetchingNextPage}
        onRefresh={refetch}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        ListHeaderComponent={
          <Text className="-mt-1 mb-1 text-sm text-muted">Track and manage your purchases</Text>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="items-center py-4">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="gap-3">
              {[0, 1, 2].map((i) => (
                <View key={i} className="gap-2 rounded-xl border border-border bg-surface p-4">
                  <View className="flex-row items-center justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </View>
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </View>
              ))}
            </View>
          ) : isError ? (
            <EmptyState icon="cloud-offline-outline" title="Couldn't load orders" subtitle="Pull to refresh." />
          ) : (
            <EmptyState
              icon="bag-handle-outline"
              title="No orders yet"
              subtitle="When you place an order, it'll show up here."
              actionLabel="Start Shopping"
              onAction={() => router.push("/(tabs)/search")}
            />
          )
        }
        renderItem={({ item }) => <OrderCard order={item} />}
      />
    </ScreenContainer>
  );
}
