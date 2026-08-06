import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../components/layout/ScreenContainer";
import { Header } from "../components/layout/Header";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { NotificationRow } from "../components/notifications/NotificationRow";
import { NotificationService } from "../lib/services/notification.service";
import { notificationRoute } from "../lib/notificationRoute";
import { qk } from "../lib/api/query-client";
import { useThemeColors } from "../theme/useThemeColors";
import { useAuthStore } from "../store/auth.store";
import type { AppNotification } from "../types/notification";

const LIMIT = 20;

export default function Notifications() {
  const colors = useThemeColors();
  const qc = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useInfiniteQuery({
    queryKey: qk.notifications,
    queryFn: ({ pageParam }) => NotificationService.list({ page: pageParam, limit: LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    enabled: isAuthenticated,
  });

  const items = useMemo<AppNotification[]>(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data]
  );
  const unreadCount = query.data?.pages[0]?.unreadCount ?? 0;

  const markRead = useMutation({
    mutationFn: (id: string) => NotificationService.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.notifications });
      qc.invalidateQueries({ queryKey: qk.notificationsUnread });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => NotificationService.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.notifications });
      qc.invalidateQueries({ queryKey: qk.notificationsUnread });
    },
  });

  const onPressRow = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    const route = notificationRoute(n.data);
    if (route) router.push(route as never);
  };

  if (!isAuthenticated) {
    return (
      <ScreenContainer>
        <Header title="Notifications" />
        <EmptyState
          icon="notifications-off-outline"
          title="Sign in to see notifications"
          subtitle="Order updates and offers show up here."
          actionLabel="Sign In"
          onAction={() => router.push("/(auth)/signin")}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title="Notifications"
        right={
          <View className="flex-row items-center">
            {unreadCount > 0 ? (
              <Pressable
                onPress={() => markAllRead.mutate()}
                hitSlop={8}
                className="flex-row items-center gap-1 px-2 py-1"
              >
                <Ionicons name="checkmark-done" size={18} color={colors.primary} />
                <Text className="text-sm font-jakarta-medium text-primary">Mark all</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push("/profile/notifications" as never)}
              hitSlop={8}
              className="p-1.5"
            >
              <Ionicons name="settings-outline" size={20} color={colors.text} />
            </Pressable>
          </View>
        }
      />

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={query.refetch}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        ItemSeparatorComponent={() => <View className="h-px bg-border" />}
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={
          query.isLoading ? (
            <View className="gap-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <View key={i} className="flex-row gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <View className="flex-1 gap-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-56" />
                    <Skeleton className="h-2 w-20" />
                  </View>
                </View>
              ))}
            </View>
          ) : query.isError ? (
            <EmptyState icon="cloud-offline-outline" title="Couldn't load notifications" subtitle="Pull to refresh." />
          ) : (
            <EmptyState
              icon="notifications-outline"
              title="No notifications yet"
              subtitle="Order updates, offers and more will appear here."
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => <NotificationRow notification={item} onPress={onPressRow} />}
      />
    </ScreenContainer>
  );
}
