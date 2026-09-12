import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { StatCard } from "../../../components/ui/StatCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Rating } from "../../../components/ui/Rating";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { AdminCustomerService } from "../../../features/admin/services/admin.services";
import { ORDER_STATUS, PAYMENT_STATUS } from "../../../lib/enums";
import { formatDate, formatDateTime, formatPrice, shortId } from "../../../lib/utils/format";
import { colors } from "../../../theme/tokens";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-2.5">
      <Text className="font-jakarta-semibold text-text">{title}</Text>
      {children}
    </Card>
  );
}

export default function AdminCustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "customers", "detail", id],
    queryFn: () => AdminCustomerService.get(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <AdminShell active="customers" title="Customer">
          <View className="gap-3 p-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </View>
        </AdminShell>
      </ScreenContainer>
    );
  }

  if (isError || !data) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <AdminShell active="customers" title="Customer">
          <EmptyState
            icon="person-outline"
            title="Couldn't load this customer"
            actionLabel={isRefetching ? "Retrying…" : "Try again"}
            onAction={() => refetch()}
          />
        </AdminShell>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="customers" title={data.name}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
          {/* Contact */}
          <Card className="gap-2">
            <Text className="text-xs text-muted">Customer since {formatDate(data.createdAt)}</Text>
            <Pressable onPress={() => Linking.openURL(`mailto:${data.email}`)} className="flex-row items-center gap-2">
              <Ionicons name="mail-outline" size={15} color={colors.muted} />
              <Text className="flex-1 text-sm text-text">{data.email}</Text>
              {data.emailVerified ? <Ionicons name="checkmark-circle" size={15} color={colors.success} /> : null}
            </Pressable>
            {data.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${data.phone}`)} className="flex-row items-center gap-2">
                <Ionicons name="call-outline" size={15} color={colors.muted} />
                <Text className="text-sm text-text">{data.phone}</Text>
              </Pressable>
            ) : (
              <View className="flex-row items-center gap-2">
                <Ionicons name="call-outline" size={15} color={colors.muted} />
                <Text className="text-sm text-muted">No phone on file</Text>
              </View>
            )}
            {data.affiliate ? (
              <View className="flex-row flex-wrap items-center gap-2">
                <Ionicons name="people-outline" size={15} color={colors.muted} />
                <Text className="text-sm text-text">Affiliate · code {data.affiliate.referralCode}</Text>
                <Badge label={data.affiliate.status.toLowerCase()} color="purple" />
              </View>
            ) : null}
            {data.referredBy ? (
              <View className="flex-row items-center gap-2">
                <Ionicons name="git-branch-outline" size={15} color={colors.muted} />
                <Text className="text-sm text-text">Referred by {data.referredBy.name}</Text>
              </View>
            ) : null}
          </Card>

          {/* Stats */}
          <View className="flex-row gap-3">
            <StatCard label="Paid orders" value={String(data.stats.orders)} icon="bag-handle-outline" />
            <StatCard label="Total spend" value={formatPrice(data.stats.totalSpend)} icon="wallet-outline" tint={colors.success} />
          </View>
          <View className="flex-row gap-3">
            <StatCard label="AOV" value={formatPrice(data.stats.aov)} icon="trending-up-outline" tint={colors.info ?? colors.primary} />
            <StatCard label="Last order" value={data.stats.lastOrderAt ? formatDate(data.stats.lastOrderAt) : "—"} icon="calendar-outline" tint={colors.warning} />
          </View>

          {/* Orders */}
          <Section title={`Orders (${data.orders.length})`}>
            {data.orders.length === 0 ? (
              <Text className="text-sm text-muted">This customer hasn&apos;t placed an order yet.</Text>
            ) : (
              data.orders.map((o, i) => (
                <Pressable
                  key={o.id}
                  onPress={() => router.push(`/admin/orders/${o.id}` as never)}
                  className={`gap-1 pt-2 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-jakarta-semibold text-primary">#{shortId(o.id)}</Text>
                    <StatusBadge value={o.status} map={ORDER_STATUS} />
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted">
                      {formatDate(o.createdAt)} · {o._count.items} {o._count.items === 1 ? "item" : "items"} ·{" "}
                      {o.paymentMethod === "COD" ? "COD" : "Online"}
                    </Text>
                    <Text className="text-sm font-jakarta-semibold text-text">{formatPrice(o.total)}</Text>
                  </View>
                  {o.payment?.status ? (
                    <View className="flex-row">
                      <StatusBadge value={o.payment.status} map={PAYMENT_STATUS} />
                    </View>
                  ) : null}
                </Pressable>
              ))
            )}
          </Section>

          {/* Addresses */}
          <Section title={`Addresses (${data.addresses.length})`}>
            {data.addresses.length === 0 ? (
              <Text className="text-sm text-muted">No saved addresses.</Text>
            ) : (
              data.addresses.map((a, i) => (
                <View key={a.id} className={`gap-0.5 pt-2 ${i > 0 ? "border-t border-border" : ""}`}>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-jakarta-medium text-text">{a.name}</Text>
                    {a.isDefault ? <Badge label="Default" color="blue" /> : null}
                  </View>
                  <Text className="text-xs text-muted">{a.address}, {a.city}, {a.state} – {a.pincode}</Text>
                  <Text className="text-xs text-faint">{a.phone}</Text>
                </View>
              ))
            )}
          </Section>

          {/* Add-to-cart activity */}
          <Section title="Recent add-to-cart activity">
            {data.cartActivity.length === 0 ? (
              <Text className="text-sm text-muted">No add-to-cart events recorded yet.</Text>
            ) : (
              <>
                {data.cartActivity.map((e, i) => (
                  <View key={e.id} className={`flex-row items-start justify-between gap-3 pt-2 ${i > 0 ? "border-t border-border" : ""}`}>
                    <View className="flex-1">
                      <Text numberOfLines={1} className="text-sm text-text">{e.product.name}</Text>
                      <Text className="text-xs text-muted">{formatDateTime(e.createdAt)} · Qty {e.quantity}</Text>
                    </View>
                    <Text className="font-mono text-[11px] text-muted">{e.ip ?? "—"}</Text>
                  </View>
                ))}
                <Text className="text-[11px] text-faint">IP addresses are personal data — use them for fraud and abuse checks only.</Text>
              </>
            )}
          </Section>

          {/* Reviews */}
          {data.reviews.length > 0 ? (
            <Section title={`Reviews (${data.reviews.length})`}>
              {data.reviews.map((r, i) => (
                <View key={r.id} className={`gap-1 pt-2 ${i > 0 ? "border-t border-border" : ""}`}>
                  <View className="flex-row items-center justify-between gap-3">
                    <Text numberOfLines={1} className="flex-1 text-sm font-jakarta-medium text-text">{r.product.name}</Text>
                    <Rating value={r.rating} />
                  </View>
                  {r.comment ? <Text className="text-xs text-muted">{r.comment}</Text> : null}
                  <Text className="text-[11px] text-faint">{formatDate(r.createdAt)}</Text>
                </View>
              ))}
            </Section>
          ) : null}
        </ScrollView>
      </AdminShell>
    </ScreenContainer>
  );
}
