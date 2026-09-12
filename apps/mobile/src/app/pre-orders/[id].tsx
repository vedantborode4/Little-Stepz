import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { AuthGuard } from "../../components/guard/guards";
import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { PreOrderService, type PreOrderStatus } from "../../lib/services/preorder.service";
import { PREORDER_STATUS } from "../../lib/enums";
import { formatDate, formatPrice, shortId } from "../../lib/utils/format";
import { pdfErrorMessage } from "../../lib/pdf";
import { getErrorMessage } from "../../lib/utils/errors";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

/** The happy path of a pre-order. Terminal states (expired, cancelled, refunded) show only the badge. */
const STEPS: { key: PreOrderStatus; label: string }[] = [
  { key: "PENDING_BOOKING", label: "Booked" },
  { key: "BOOKED", label: "Awaiting restock" },
  { key: "AWAITING_BALANCE", label: "Balance due" },
  { key: "COMPLETED", label: "Completed" },
];

function Progress({ status }: { status: PreOrderStatus }) {
  const current = STEPS.findIndex((s) => s.key === status);
  if (current === -1) return null;
  return (
    <View className="mt-3">
      <View className="flex-row items-center">
        {STEPS.map((s, i) => {
          const done = i <= current;
          const last = i === STEPS.length - 1;
          return (
            <View key={s.key} className={last ? "" : "flex-1"} style={last ? undefined : { flexDirection: "row", alignItems: "center" }}>
              <View className={`h-6 w-6 items-center justify-center rounded-full ${done ? "bg-primary" : "bg-border"}`}>
                {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text className="text-[10px] font-jakarta-bold text-muted">{i + 1}</Text>}
              </View>
              {!last ? <View className={`mx-1 h-0.5 flex-1 ${i < current ? "bg-primary" : "bg-border"}`} /> : null}
            </View>
          );
        })}
      </View>
      <View className="mt-1 flex-row justify-between">
        {STEPS.map((s) => (
          <Text key={s.key} className="text-center text-[9px] text-muted" style={{ width: "25%" }}>
            {s.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function PreOrderDetailScreen() {
  return (
    <AuthGuard>
      <PreOrderDetail />
    </AuthGuard>
  );
}

function PreOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: po, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["pre-orders", id],
    queryFn: () => PreOrderService.getById(id),
    enabled: !!id,
  });

  const payBalance = async (token: string) => {
    if (paying) return;
    setPaying(true);
    try {
      const init = await PreOrderService.createBalancePayment(token);
      router.push({
        pathname: "/pre-order/payment",
        params: {
          razorpayOrderId: init.razorpayOrderId,
          amount: String(init.amount),
          currency: init.currency,
          keyId: init.keyId,
          mode: "balance",
          token,
        },
      });
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not start payment"));
      refetch();
    } finally {
      setPaying(false);
    }
  };

  const downloadReceipt = async () => {
    if (!po || downloading) return;
    setDownloading(true);
    try {
      await PreOrderService.downloadReceipt(po.id);
    } catch (e) {
      toast.error(await pdfErrorMessage(e, "Couldn't download the receipt"));
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Pre-order" />
        <View className="gap-3 p-4">
          {[0, 1, 2].map((i) => (
            <View key={i} className="gap-2 rounded-xl border border-border bg-surface p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-12 w-full" />
            </View>
          ))}
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !po) {
    return (
      <ScreenContainer>
        <Header title="Pre-order" />
        <EmptyState
          icon="cloud-offline-outline"
          title="Pre-order not found"
          subtitle="It may have been removed, or the connection dropped."
          actionLabel={isRefetching ? "Retrying…" : "Try again"}
          onAction={() => refetch()}
        />
      </ScreenContainer>
    );
  }

  const subtotal = Number(po.unitPrice) * Number(po.quantity);
  const canPay = po.status === "AWAITING_BALANCE" && !!po.balanceToken;

  return (
    <ScreenContainer>
      <Header title={`Pre-order #${shortId(po.id)}`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <Card className="gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="font-jakarta-semibold text-text">Status</Text>
            <StatusBadge value={po.status} map={PREORDER_STATUS} />
          </View>
          <Text className="text-sm text-muted">Booked on {formatDate(po.createdAt)}</Text>
          <Progress status={po.status} />
        </Card>

        {/* Product */}
        <Pressable onPress={() => router.push(`/product/${po.product.slug}` as never)} accessibilityRole="link">
          <Card className="flex-row items-center gap-3">
            <View className="h-16 w-16 overflow-hidden rounded-lg border border-border bg-surface-2">
              {po.product.images?.[0]?.url ? (
                <Image source={{ uri: po.product.images[0].url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : null}
            </View>
            <View className="flex-1">
              <Text numberOfLines={2} className="text-sm font-jakarta-medium text-text">{po.product.name}</Text>
              {po.variant?.name ? <Text className="text-xs text-muted">{po.variant.name}</Text> : null}
              <Text className="text-xs text-muted">Qty {po.quantity}</Text>
            </View>
            <Text className="text-sm font-jakarta-semibold text-text">{formatPrice(subtotal)}</Text>
          </Card>
        </Pressable>

        {/* Payment summary */}
        <Card className="gap-1.5">
          <Text className="mb-1 font-jakarta-semibold text-text">Payment summary</Text>
          <Row label={`Subtotal (${po.quantity} × ${formatPrice(po.unitPrice)})`} value={formatPrice(subtotal)} />
          {Number(po.shippingCharges) > 0 ? <Row label="Shipping" value={formatPrice(po.shippingCharges)} /> : null}
          <View className="my-1 h-px bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="font-jakarta-bold text-text">Order total</Text>
            <Text className="font-jakarta-bold text-text">{formatPrice(po.totalAmount)}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-success">
              Booking paid{po.bookingPaidAt ? ` · ${formatDate(po.bookingPaidAt)}` : ""}
            </Text>
            <Text className="text-sm text-success">{formatPrice(po.bookingAmount)}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-sm text-muted">
              Balance {po.balancePaidAt ? "paid" : "remaining"}
              {po.balanceDueAt && !po.balancePaidAt ? ` · due ${formatDate(po.balanceDueAt)}` : ""}
            </Text>
            <Text className={po.balancePaidAt ? "text-sm font-jakarta-medium text-success" : "text-sm font-jakarta-semibold text-text"}>
              {formatPrice(po.balanceAmount)}
            </Text>
          </View>
        </Card>

        {/* Actions */}
        <View className="gap-2">
          {canPay ? (
            <>
              <Button label={`Pay Balance ${formatPrice(po.balanceAmount)}`} loading={paying} onPress={() => payBalance(po.balanceToken!)} />
              <Text className="text-center text-xs text-muted">
                Your item is back in stock. Pay the remaining balance to complete your order.
              </Text>
            </>
          ) : null}
          {po.status === "BOOKED" ? (
            <Card elevated={false} className="flex-row items-start gap-2">
              <Ionicons name="notifications-outline" size={16} color={colors.primary} />
              <Text className="flex-1 text-sm text-muted">
                We&apos;ll notify you as soon as this is back in stock, with a link to pay the balance.
              </Text>
            </Card>
          ) : null}
          {po.status === "EXPIRED" ? (
            <Card elevated={false} className="flex-row items-start gap-2">
              <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
              <Text className="flex-1 text-sm text-muted">
                The balance wasn&apos;t paid in time, so this pre-order has expired. Contact support if you need help.
              </Text>
            </Card>
          ) : null}
          {po.status === "COMPLETED" && po.orderId ? (
            <Button label="View Linked Order" variant="outline" onPress={() => router.push(`/orders/${po.orderId}` as never)} />
          ) : null}
          {po.bookingPaidAt ? (
            <>
              <Button
                label={downloading ? "Preparing receipt…" : "Download Booking Receipt"}
                variant="outline"
                loading={downloading}
                onPress={downloadReceipt}
                left={<Ionicons name="download-outline" size={16} color={colors.primary} />}
              />
              <Text className="text-center text-xs text-muted">
                Acknowledgement of the booking amount received. Not a tax invoice — that is issued
                once the balance is paid and the order ships.
              </Text>
            </>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1 text-sm text-muted">{label}</Text>
      <Text className="text-sm text-text">{value}</Text>
    </View>
  );
}
