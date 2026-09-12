import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { PagedList } from "../../../components/ui/PagedList";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DateField } from "../../../components/ui/DateField";
import { Sheet } from "../../../components/ui/Sheet";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SelectSheet } from "../../../components/ui/SelectSheet";
import {
  AdminOrderService,
  type AdminOrder,
  type AdminOrdersQuery,
  type AdminOrdersResponse,
} from "../../../features/admin/services/admin.services";
import { useAdminUi } from "../../../features/admin/store";
import { ORDER_STATUS, ORDER_STATUS_VALUES } from "../../../lib/enums";
import { formatDate, formatPrice, shortId } from "../../../lib/utils/format";
import { colors } from "../../../theme/tokens";

/** Payment plan and outstanding-money filters, folded into one picker as on web. */
type PlanFilter = "" | "plan:FULL" | "balance:due" | "balance:settled";

const PLAN_OPTIONS: { label: string; value: PlanFilter }[] = [
  { label: "All plans", value: "" },
  { label: "Paid in full", value: "plan:FULL" },
  { label: "Partial — balance due", value: "balance:due" },
  { label: "Partial — settled", value: "balance:settled" },
];

/** The picked day, from its first to its last millisecond in local time. */
const dayStart = (iso: string) => {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const dayEnd = (iso: string) => {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

export default function AdminOrders() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [plan, setPlan] = useState<PlanFilter>("");
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const setSelectedOrder = useAdminUi((s) => s.setSelectedOrder);

  const params = useMemo<AdminOrdersQuery>(() => {
    const p: AdminOrdersQuery = { limit: 20 };
    if (status) p.status = status;
    if (plan.startsWith("plan:")) p.paymentPlan = plan.slice(5) as "FULL";
    if (plan.startsWith("balance:")) p.balanceState = plan.slice(8) as "due" | "settled";
    if (fromDate) p.fromDate = dayStart(fromDate);
    if (toDate) p.toDate = dayEnd(toDate);
    return p;
  }, [status, plan, fromDate, toDate]);

  const query = useInfiniteQuery({
    queryKey: ["admin", "orders", params],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => AdminOrderService.getOrders({ ...params, page: pageParam }),
    getNextPageParam: (last: AdminOrdersResponse) => (last.page < last.pages ? last.page + 1 : undefined),
  });

  const statusOptions = useMemo(
    () => [{ label: "All statuses", value: "" }, ...ORDER_STATUS_VALUES.map((s) => ({ label: ORDER_STATUS[s].label, value: s }))],
    []
  );

  const first = query.data?.pages[0];
  const outstandingTotal = first?.outstandingTotal ?? 0;
  const outstandingCount = first?.outstandingCount ?? 0;
  const extraFilterCount = (plan ? 1 : 0) + (fromDate ? 1 : 0) + (toDate ? 1 : 0);
  const rangeInvalid = !!fromDate && !!toDate && new Date(dayEnd(toDate)) < new Date(dayStart(fromDate));

  const clearFilters = () => {
    setStatus(undefined);
    setPlan("");
    setFromDate(null);
    setToDate(null);
  };

  const open = (o: AdminOrder) => {
    setSelectedOrder(o);
    router.push(`/admin/orders/${o.id}`);
  };

  const header = (
    <View className="gap-2 pb-1">
      {first ? (
        <Text className="text-xs text-muted">
          {first.total} {first.total === 1 ? "order" : "orders"}
          {extraFilterCount || status ? " match these filters" : ""}
        </Text>
      ) : null}
      {/* Cash in the field waiting to be collected — the number an operator acts on. */}
      {outstandingCount > 0 ? (
        <Pressable onPress={() => setPlan("balance:due")} accessibilityRole="button">
          <Card elevated={false} className="flex-row items-center gap-2 border border-warning/40 py-3">
            <Ionicons name="wallet-outline" size={18} color={colors.warning} />
            <Text className="flex-1 text-sm text-text">
              <Text className="font-jakarta-bold">{formatPrice(outstandingTotal)}</Text> outstanding across{" "}
              {outstandingCount} {outstandingCount === 1 ? "order" : "orders"}
            </Text>
            {plan !== "balance:due" ? <Text className="text-xs font-jakarta-semibold text-primary">View</Text> : null}
          </Card>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="orders" title="Orders">
        <View className="flex-row items-center gap-2 px-4 pt-3">
          <View className="flex-1">
            <SelectSheet
              placeholder="Filter by status"
              value={status ?? ""}
              options={statusOptions}
              onChange={(v) => setStatus(v || undefined)}
            />
          </View>
          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="More filters"
            className="flex-row items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-3"
          >
            <Ionicons name="options-outline" size={18} color={extraFilterCount ? colors.primary : colors.muted} />
            <Text className={extraFilterCount ? "text-sm font-jakarta-semibold text-primary" : "text-sm text-muted"}>
              {extraFilterCount ? `Filters · ${extraFilterCount}` : "Filters"}
            </Text>
          </Pressable>
        </View>

        <PagedList<AdminOrder>
          query={query}
          header={header}
          flatten={(d) => d.pages.flatMap((p: AdminOrdersResponse) => p.orders ?? [])}
          keyExtractor={(o) => o.id}
          emptyIcon="receipt-outline"
          emptyTitle={extraFilterCount || status ? "No orders match these filters" : "No orders"}
          renderItem={(o) => (
            <Pressable onPress={() => open(o)}>
              <Card className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text className="font-jakarta-semibold text-text">#{shortId(o.id)}</Text>
                  <StatusBadge value={o.status} map={ORDER_STATUS} />
                </View>
                <Text className="text-sm text-muted">{o.user?.name ?? "Customer"} · {formatDate(o.createdAt)}</Text>
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 flex-row flex-wrap items-center gap-1.5">
                    <Text className="text-xs text-muted">{o.paymentMethod === "COD" ? "Cash on Delivery" : "Online"}</Text>
                    {o.paymentPlan === "PARTIAL" ? <Badge label="Deposit" color="teal" /> : null}
                    {o.balanceOutstanding ? <Badge label={`${formatPrice(o.balanceOutstanding)} due`} color="amber" /> : null}
                    {o.manualFulfilment ? <Badge label="Local" color="gray" /> : null}
                  </View>
                  <Text className="font-jakarta-bold text-text">{formatPrice(o.total)}</Text>
                </View>
              </Card>
            </Pressable>
          )}
        />
      </AdminShell>

      <Sheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter orders">
        <View className="gap-3">
          <SelectSheet
            label="Payment plan"
            value={plan}
            options={PLAN_OPTIONS}
            onChange={(v) => setPlan(v as PlanFilter)}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <DateField label="From" value={fromDate} onChange={setFromDate} placeholder="Any date" />
            </View>
            <View className="flex-1">
              <DateField label="To" value={toDate} onChange={setToDate} placeholder="Any date" />
            </View>
          </View>
          {rangeInvalid ? (
            <Text className="text-xs text-danger">&apos;To&apos; is before &apos;From&apos; — no orders will match.</Text>
          ) : null}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="Clear All" variant="outline" onPress={clearFilters} />
            </View>
            <View className="flex-1">
              <Button label="Done" onPress={() => setFiltersOpen(false)} />
            </View>
          </View>
        </View>
      </Sheet>
    </ScreenContainer>
  );
}
