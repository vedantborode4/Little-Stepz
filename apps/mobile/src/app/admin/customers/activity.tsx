import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { PagedList } from "../../../components/ui/PagedList";
import { Card } from "../../../components/ui/Card";
import { AdminCustomerService, type CartActivityEvent } from "../../../features/admin/services/admin.services";
import { formatDateTime } from "../../../lib/utils/format";
import { colors } from "../../../theme/tokens";

/** Every add-to-cart event, newest first — signed-in customers and guest sessions alike. */
export default function AdminCartActivity() {
  const query = useInfiniteQuery({
    queryKey: ["admin", "customers", "activity"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => AdminCustomerService.cartActivity({ page: pageParam, limit: 50 }),
    getNextPageParam: (last) => {
      const pg = last.pagination;
      return pg && pg.page < pg.totalPages ? pg.page + 1 : undefined;
    },
  });

  const total = query.data?.pages[0]?.pagination?.total;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="cart-activity" title="Cart Activity">
        <PagedList<CartActivityEvent>
          query={query}
          flatten={(d) => d.pages.flatMap((p: any) => p.events ?? [])}
          keyExtractor={(e) => e.id}
          emptyIcon="pulse-outline"
          emptyTitle="No add-to-cart events recorded yet"
          header={
            <View className="gap-1.5">
              {total != null ? <Text className="text-xs text-muted">{total} add-to-cart events</Text> : null}
              <View className="flex-row items-start gap-1.5">
                <Ionicons name="shield-outline" size={12} color={colors.faint} />
                <Text className="flex-1 text-[11px] text-faint">
                  IP addresses are personal data under the DPDP Act. Use them for fraud and abuse investigation only.
                </Text>
              </View>
            </View>
          }
          renderItem={(e) => (
            <Card className="gap-1">
              <View className="flex-row items-center justify-between gap-3">
                <Text numberOfLines={1} className="flex-1 font-jakarta-medium text-text">{e.product.name}</Text>
                <Text className="text-xs text-muted">Qty {e.quantity}</Text>
              </View>
              <View className="flex-row items-center justify-between gap-3">
                {e.user ? (
                  <Pressable onPress={() => router.push({ pathname: "/admin/customers/[id]", params: { id: e.user!.id } } as never)}>
                    <Text className="text-sm font-jakarta-medium text-primary">{e.user.name}</Text>
                  </Pressable>
                ) : (
                  <Text className="text-sm text-faint">Guest{e.sessionId ? ` · ${e.sessionId.slice(0, 8)}` : ""}</Text>
                )}
                <Text className="font-mono text-[11px] text-muted">{e.ip ?? "—"}</Text>
              </View>
              <Text className="text-[11px] text-faint">{formatDateTime(e.createdAt)}</Text>
            </Card>
          )}
        />
      </AdminShell>
    </ScreenContainer>
  );
}
