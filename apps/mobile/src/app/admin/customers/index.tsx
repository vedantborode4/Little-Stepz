import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { PagedList } from "../../../components/ui/PagedList";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { SelectSheet } from "../../../components/ui/SelectSheet";
import {
  AdminCustomerService,
  type AdminCustomer,
  type CustomerSegment,
  type CustomerSort,
} from "../../../features/admin/services/admin.services";
import { formatDate, formatPrice } from "../../../lib/utils/format";
import { colors } from "../../../theme/tokens";

const SEGMENTS: { label: string; value: CustomerSegment }[] = [
  { label: "All customers", value: "all" },
  { label: "With orders", value: "with-orders" },
  { label: "Without orders", value: "without-orders" },
  { label: "Affiliates", value: "affiliates" },
];

const SORTS: { label: string; value: CustomerSort }[] = [
  { label: "Newest first", value: "recent" },
  { label: "Oldest first", value: "oldest" },
  { label: "Name (A–Z)", value: "name" },
  { label: "Highest spend", value: "spend" },
  { label: "Most orders", value: "orders" },
];

export default function AdminCustomers() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<CustomerSegment>("all");
  const [sort, setSort] = useState<CustomerSort>("recent");

  // Debounced so a typed query doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query = useInfiniteQuery({
    queryKey: ["admin", "customers", { search, segment, sort }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      AdminCustomerService.list({ page: pageParam, limit: 20, segment, sort, ...(search ? { search } : {}) }),
    getNextPageParam: (last) => {
      const pg = last.pagination;
      return pg && pg.page < pg.totalPages ? pg.page + 1 : undefined;
    },
  });

  const total = query.data?.pages[0]?.pagination?.total;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="customers" title="Customers">
        <View className="gap-2 px-4 pt-3">
          <View className="flex-row items-center rounded-lg border border-border bg-surface px-3">
            <Ionicons name="search-outline" size={16} color={colors.muted} />
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search by name, email or phone"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className="ml-2 flex-1 py-2.5 text-text"
            />
            {searchInput ? (
              <Pressable onPress={() => setSearchInput("")} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <SelectSheet value={segment} options={SEGMENTS} onChange={(v) => setSegment(v as CustomerSegment)} />
            </View>
            <View className="flex-1">
              <SelectSheet value={sort} options={SORTS} onChange={(v) => setSort(v as CustomerSort)} />
            </View>
          </View>
        </View>

        <PagedList<AdminCustomer>
          query={query}
          flatten={(d) => d.pages.flatMap((p: any) => p.customers ?? [])}
          keyExtractor={(c) => c.id}
          emptyIcon="people-outline"
          emptyTitle={search || segment !== "all" ? "No customers match this filter" : "No customers yet"}
          header={
            total != null ? (
              <Text className="text-xs text-muted">
                {total} {total === 1 ? "customer" : "customers"} · total spend counts paid orders only
              </Text>
            ) : undefined
          }
          renderItem={(c) => (
            <Pressable onPress={() => router.push({ pathname: "/admin/customers/[id]", params: { id: c.id } } as never)}>
              <Card className="gap-1.5">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Text numberOfLines={1} className="font-jakarta-semibold text-text">{c.name}</Text>
                      {c.isAffiliate ? <Badge label="Affiliate" color="purple" /> : null}
                    </View>
                    <Text numberOfLines={1} className="text-xs text-muted">{c.email}</Text>
                    {c.phone ? <Text className="text-xs text-faint">{c.phone}</Text> : null}
                  </View>
                  <View className="items-end">
                    <Text className="font-jakarta-bold text-text">{formatPrice(c.totalSpend)}</Text>
                    <Text className="text-[11px] text-faint">{c.orders} {c.orders === 1 ? "order" : "orders"}</Text>
                  </View>
                </View>
                <View className="flex-row justify-between border-t border-border pt-1.5">
                  <Text className="text-[11px] text-faint">Joined {formatDate(c.registeredAt)}</Text>
                  <Text className="text-[11px] text-faint">
                    {[c.city, c.state].filter(Boolean).join(", ") || `AOV ${formatPrice(c.aov)}`}
                  </Text>
                </View>
              </Card>
            </Pressable>
          )}
        />
      </AdminShell>
    </ScreenContainer>
  );
}
