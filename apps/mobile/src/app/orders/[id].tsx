import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ORDER_STATUS, PAYMENT_STATUS } from "../../lib/enums";
import { OrderService } from "../../lib/services/order.service";
import { qk } from "../../lib/api/query-client";
import { formatPrice, formatDate, shortId } from "../../lib/utils/format";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";
import {
  refundMessage,
  REFUND_INITIATED_TEXT,
  balanceAtDoorText,
  cancelForfeitWarning,
  depositForfeitedText,
} from "@repo/content/index";

// Aligned with web (apps/web/app/account/orders/[id]/page.tsx)
const CANCELLABLE = ["PENDING", "CONFIRMED"];
const RETURNABLE = ["DELIVERED"];

const CANCEL_REASONS = [
  "Ordered by mistake",
  "Found a better price",
  "Shipping taking too long",
  "Payment issue",
  "Other",
];
const RETURN_REASONS = [
  "Damaged or defective item",
  "Wrong item delivered",
  "Item not as described",
  "Changed my mind",
  "Other",
];

const STATUS_STEPS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const STEP_LABELS = ["Pending", "Confirmed", "Processing", "Shipped", "Out for delivery", "Delivered"];

function OrderProgress({ status }: { status: string }) {
  const current = STATUS_STEPS.indexOf(status.toUpperCase());
  if (current === -1) return null;
  return (
    <View className="mt-2">
      <View className="flex-row items-center">
        {STATUS_STEPS.map((s, i) => {
          const done = i <= current;
          const last = i === STATUS_STEPS.length - 1;
          return (
            <View key={s} className={last ? "" : "flex-1"} style={last ? undefined : { flexDirection: "row", alignItems: "center" }}>
              <View className={`h-6 w-6 items-center justify-center rounded-full ${done ? "bg-primary" : "bg-border"}`}>
                {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text className="text-[10px] font-jakarta-bold text-muted">{i + 1}</Text>}
              </View>
              {!last ? <View className={`mx-1 h-0.5 flex-1 ${i < current ? "bg-primary" : "bg-border"}`} /> : null}
            </View>
          );
        })}
      </View>
      <View className="mt-1 flex-row justify-between">
        {STEP_LABELS.map((l) => (
          <Text key={l} className="text-center text-[8px] text-muted" style={{ width: "15%" }}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: order, isLoading, isError } = useQuery({
    queryKey: qk.order(id),
    queryFn: () => OrderService.getById(id),
    enabled: !!id,
  });

  const [actionMode, setActionMode] = useState<"cancel" | "return" | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  /** Refund sentence to show after a successful cancellation. */
  const [cancelResult, setCancelResult] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.order(id) });
    qc.invalidateQueries({ queryKey: qk.orders });
  };

  const openAction = (mode: "cancel" | "return") => {
    setReason("");
    setActionMode(mode);
  };

  const submitAction = async () => {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }
    setSubmitting(true);
    try {
      if (actionMode === "return") {
        await OrderService.requestReturn(id, reason);
        toast.success("Return requested");
        setActionMode(null);
      } else {
        // The API reports what happened to the money ("initiated" | "none" |
        // "failed") and this was being thrown away, so the customer learned nothing
        // about their refund. COD in particular must NOT be promised one.
        // The forfeiture warning above is rendered under exactly this condition, so
        // the acknowledgement is only sent when the customer has actually seen it.
        const depositAtRisk = order?.partial?.balanceStatus === "DUE";
        const res: any = await OrderService.cancelOrder(id, reason, depositAtRisk);
        setCancelResult(
          depositAtRisk && order?.partial
            ? depositForfeitedText(order.partial.depositAmount)
            : refundMessage(res?.refund)
        );
        toast.success("Order cancelled");
      }
      refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const reasons = actionMode === "return" ? RETURN_REASONS : CANCEL_REASONS;

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Order" />
        <View className="gap-3 p-4">
          {[0, 1, 2].map((i) => (
            <View key={i} className="gap-2 rounded-xl border border-border bg-surface p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-16 w-full" />
            </View>
          ))}
        </View>
      </ScreenContainer>
    );
  }
  if (isError || !order) {
    return (
      <ScreenContainer>
        <Header title="Order" />
        <EmptyState icon="cloud-offline-outline" title="Order not found" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header title={`Order #${shortId(order.id)}`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="font-jakarta-semibold text-text">Status</Text>
            <StatusBadge value={order.status} map={ORDER_STATUS} />
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted">Placed on</Text>
            <Text className="text-sm text-text">{formatDate(order.createdAt)}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted">Payment</Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-text">{order.paymentMethod}</Text>
              {order.payment?.status ? <StatusBadge value={order.payment.status} map={PAYMENT_STATUS} /> : null}
            </View>
          </View>
          <OrderProgress status={order.status} />
        </Card>

        {/* A cancelled prepaid order still owes money — findable after the sheet closes. */}
        {order.status === "CANCELLED" && order.paymentMethod !== "COD" ? (
          <Card className="flex-row items-start gap-2">
            <Ionicons name="card-outline" size={18} color={colors.primary} />
            <Text className="flex-1 text-sm text-muted">{REFUND_INITIATED_TEXT}</Text>
          </Card>
        ) : null}

        {/* Items */}
        <Card className="gap-3">
          <Text className="font-jakarta-semibold text-text">Items</Text>
          {order.items?.map((it, idx) => (
            <View key={it.id ?? idx} className="flex-row gap-3">
              <View className="h-14 w-14 overflow-hidden rounded-md bg-border">
                {(it.variant?.images?.[0]?.url || it.product?.images?.[0]?.url) ? (
                  <Image source={{ uri: it.variant?.images?.[0]?.url || it.product?.images?.[0]?.url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : null}
              </View>
              <View className="flex-1">
                <Text numberOfLines={2} className="text-sm font-jakarta-medium text-text">{it.product?.name ?? "Item"}</Text>
                {it.variant?.name ? <Text className="text-xs text-muted">{it.variant.name}</Text> : null}
                <Text className="text-xs text-muted">Qty {it.quantity}</Text>
              </View>
              <Text className="text-sm font-jakarta-medium text-text">{formatPrice(Number(it.price) * it.quantity)}</Text>
            </View>
          ))}
        </Card>

        {/* Address */}
        {order.address ? (
          <Card className="gap-1">
            <Text className="font-jakarta-semibold text-text">Delivery address</Text>
            <Text className="text-sm text-text">{order.address.name} · {order.address.phone}</Text>
            <Text className="text-sm text-muted">
              {order.address.address}, {order.address.city}, {order.address.state} - {order.address.pincode}
            </Text>
          </Card>
        ) : null}

        {/* Totals */}
        <Card className="gap-1">
          {order.subtotal != null ? <Row label="Subtotal" value={formatPrice(order.subtotal)} /> : null}
          {order.discount != null && Number(order.discount) > 0 ? <Row label="Discount" value={`- ${formatPrice(order.discount)}`} /> : null}
          {order.shippingCharges != null && Number(order.shippingCharges) > 0 ? <Row label="Shipping" value={formatPrice(order.shippingCharges)} /> : null}
          <View className="my-1 h-px bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="font-jakarta-bold text-text">Total</Text>
            <Text className="font-jakarta-bold text-text">{formatPrice(order.total)}</Text>
          </View>
          {order.partial ? (
            <>
              <Row
                label="Deposit paid"
                value={`- ${formatPrice(order.partial.depositAmount)}`}
              />
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-jakarta-semibold text-text">
                  {order.partial.balanceStatus === "PAID" ? "Balance paid" : "Balance due"}
                </Text>
                <Text
                  className={
                    order.partial.balanceStatus === "PAID"
                      ? "text-sm font-jakarta-semibold text-success"
                      : "text-sm font-jakarta-bold text-text"
                  }
                >
                  {formatPrice(order.partial.balanceAmount)}
                </Text>
              </View>
            </>
          ) : null}
        </Card>

        {/* Balance — only while something is actually outstanding. */}
        {order.partial && order.partial.balanceStatus === "DUE" ? (
          <Card className="gap-2 border border-warning/40">
            <View className="flex-row items-center gap-2">
              <Ionicons name="wallet-outline" size={18} color={colors.warning} />
              <Text className="font-jakarta-semibold text-text">Balance due</Text>
            </View>
            <Text className="text-sm text-muted">
              {balanceAtDoorText(order.partial.balanceAmount)}
            </Text>
          </Card>
        ) : null}

        {order.partial?.depositForfeited ? (
          <Card className="gap-2 border border-border">
            <Text className="text-sm text-muted">
              {depositForfeitedText(order.partial.depositAmount)}
            </Text>
          </Card>
        ) : null}

        {/* Actions */}
        <View className="gap-2">
          {/* A partial order's tax invoice is raised at dispatch so it travels with the
              goods, so this cannot gate on the payment being fully settled. */}
          {(order.invoiceAvailable ?? order.payment?.status === "SUCCESS") ? (
            <Button
              label={downloadingInvoice ? "Preparing invoice…" : "Download Invoice"}
              variant="outline"
              loading={downloadingInvoice}
              onPress={async () => {
                if (downloadingInvoice) return;
                setDownloadingInvoice(true);
                try {
                  await OrderService.downloadInvoice(order.id);
                } catch {
                  toast.error("Couldn't download the invoice. Please try again.");
                } finally {
                  setDownloadingInvoice(false);
                }
              }}
            />
          ) : null}
          {/* The deposit acknowledgement. Gated separately from the invoice because it
              exists from the moment the deposit is captured, not from dispatch. */}
          {order.partial?.depositPaidAt ? (
            <Button
              label={downloadingReceipt ? "Preparing receipt…" : "Download receipt"}
              variant="outline"
              loading={downloadingReceipt}
              onPress={async () => {
                if (downloadingReceipt) return;
                setDownloadingReceipt(true);
                try {
                  await OrderService.downloadReceipt(order.id);
                } catch {
                  toast.error("Couldn't download the receipt. Please try again.");
                } finally {
                  setDownloadingReceipt(false);
                }
              }}
            />
          ) : null}
          {order.trackingUrl ? (
            <Button label="Track Shipment" variant="outline" onPress={() => Linking.openURL(order.trackingUrl!)} />
          ) : null}
          {CANCELLABLE.includes(order.status) ? (
            <Button label="Cancel Order" variant="danger" onPress={() => openAction("cancel")} />
          ) : null}
          {RETURNABLE.includes(order.status) ? (
            <Button label="Request Return" variant="outline" onPress={() => openAction("return")} />
          ) : null}
          {CANCELLABLE.includes(order.status) ? (
            <Text className="text-center text-xs text-muted">Orders can be cancelled while Pending or Confirmed.</Text>
          ) : null}
          {RETURNABLE.includes(order.status) ? (
            <Text className="text-center text-xs text-muted">Returns can be requested within the return window after delivery.</Text>
          ) : null}
        </View>
      </ScrollView>

      <Sheet
        visible={actionMode !== null}
        onClose={() => (submitting ? null : (setActionMode(null), setCancelResult(null)))}
        title={
          cancelResult
            ? "Order cancelled"
            : actionMode === "return"
              ? "Request a return"
              : "Cancel order"
        }
      >
        {/* Money information must outlive a toast — keep the sheet open and state it. */}
        {cancelResult ? (
          <View>
            <View className="mb-4 flex-row items-start gap-2">
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text className="flex-1 text-sm text-muted">{cancelResult}</Text>
            </View>
            <Button
              label="Done"
              onPress={() => {
                setCancelResult(null);
                setActionMode(null);
              }}
            />
          </View>
        ) : (
        <>
        {actionMode === "cancel" && order.partial?.balanceStatus === "DUE" ? (
          <View className="mb-3 flex-row items-start gap-2 rounded-lg bg-warning/10 px-3 py-2">
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text className="flex-1 text-xs text-warning">
              {cancelForfeitWarning(order.partial.depositAmount)}
            </Text>
          </View>
        ) : null}
        <Text className="mb-2 text-sm text-muted">
          {actionMode === "return"
            ? "Tell us why you'd like to return this order."
            : "Tell us why you're cancelling this order."}
        </Text>
        {reasons.map((r) => {
          const on = reason === r;
          return (
            <Pressable
              key={r}
              onPress={() => setReason(r)}
              className="flex-row items-center justify-between py-3"
            >
              <Text className={on ? "font-jakarta-semibold text-primary" : "text-text"}>{r}</Text>
              <Ionicons
                name={on ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={on ? colors.primary : colors.muted}
              />
            </Pressable>
          );
        })}
        <View className="mt-2">
          <Button
            label={actionMode === "return" ? "Request Return" : "Cancel Order"}
            variant={actionMode === "return" ? "primary" : "danger"}
            loading={submitting}
            disabled={!reason}
            onPress={submitAction}
          />
        </View>
        </>
        )}
      </Sheet>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm text-text">{value}</Text>
    </View>
  );
}
