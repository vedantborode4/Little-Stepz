import { useState } from "react";
import { Alert, Image, Linking, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Sheet } from "../../../components/ui/Sheet";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Badge } from "../../../components/ui/Badge";
import { SelectSheet } from "../../../components/ui/SelectSheet";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import {
  AdminOrderService,
  type BalanceCollectionMethod,
  type CancellationParty,
} from "../../../features/admin/services/admin.services";
import { ORDER_STATUS, PAYMENT_STATUS } from "../../../lib/enums";
import { formatDate, formatDateTime, formatPrice, shortId } from "../../../lib/utils/format";
import { getErrorMessage } from "../../../lib/utils/errors";
import { pdfErrorMessage } from "../../../lib/pdf";
import { toast } from "../../../store/toast.store";
import { colors } from "../../../theme/tokens";

/**
 * The statuses an admin can move an order to from here. Mirrors the backend's
 * `statusTransitions`, limited to what PUT /admin/orders/:id/status accepts — returns
 * and refunds run through the Approve / Reject Return actions instead.
 */
const NEXT_STATUSES: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
};

/** Mirrors the server's guards, so a button is only shown when the action can succeed. */
const SHIPPABLE = ["CONFIRMED", "PROCESSING"];
const SHIPMENT_CANCELLABLE = ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"];
const FULFILMENT_SWITCHABLE = ["PENDING", "CONFIRMED", "PROCESSING"];

const BALANCE_METHODS: { label: string; value: BalanceCollectionMethod }[] = [
  { label: "Cash", value: "CASH" },
  { label: "Bank transfer", value: "BANK_TRANSFER" },
  { label: "UPI", value: "UPI" },
  { label: "Other", value: "OTHER" },
];

const statusLabel = (s: string) => ORDER_STATUS[s]?.label ?? s;

type BusyAction = "status" | "ship" | "cancelShipment" | "fulfilment" | "markPaid" | "return" | "invoice";

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ["admin", "orders", id],
    queryFn: () => AdminOrderService.getById(id),
    enabled: !!id,
  });

  const [newStatus, setNewStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction | null>(null);

  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [method, setMethod] = useState<BalanceCollectionMethod>("CASH");
  const [reference, setReference] = useState("");
  const [paidNote, setPaidNote] = useState("");

  const [returnAction, setReturnAction] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [returnNote, setReturnNote] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    refetch();
  };

  /** Runs one admin action with a shared busy flag, success toast and friendly error. */
  const run = async (action: BusyAction, fn: () => Promise<unknown>, ok: string, fallback: string) => {
    setBusy(action);
    try {
      await fn();
      toast.success(ok);
      invalidate();
      return true;
    } catch (e) {
      toast.error(getErrorMessage(e, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <AdminShell active="orders" title="Order">
          <View className="gap-3 p-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </View>
        </AdminShell>
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <AdminShell active="orders" title="Order">
          <EmptyState icon="receipt-outline" title="Order not found" subtitle="It may have been removed." />
        </AdminShell>
      </ScreenContainer>
    );
  }

  const nextStatuses = NEXT_STATUSES[order.status] ?? [];
  const manual = !!order.manualFulfilment;
  const partial = order.partial;
  const balanceDue = partial?.balanceStatus === "DUE" && !partial.depositForfeited;
  // The same condition the API uses to demand a cancellation party.
  const depositAtRisk = partial != null && order.payment?.status === "PARTIALLY_PAID";
  const shipment = order.shipments[0];

  const applyStatus = async (target: string, party?: CancellationParty) => {
    const ok = await run(
      "status",
      () => AdminOrderService.updateStatus(order.id, target, party),
      `Status updated to ${statusLabel(target)}`,
      "Could not update status"
    );
    if (ok) setNewStatus(null);
  };

  const updateStatus = () => {
    if (!newStatus) return;
    const target = newStatus;

    // Cancelling a deposit-paid order has opposite money outcomes depending on who is
    // cancelling, so the admin has to say which — it cannot be inferred afterwards.
    if (target === "CANCELLED" && depositAtRisk && partial) {
      const deposit = formatPrice(partial.depositAmount);
      Alert.alert("Who is cancelling?", `A deposit of ${deposit} has been paid on this order.`, [
        { text: "Back", style: "cancel" },
        { text: `We can't fulfil it — refund ${deposit}`, onPress: () => applyStatus(target, "MERCHANT") },
        { text: `Customer asked — keep ${deposit}`, style: "destructive", onPress: () => applyStatus(target, "CUSTOMER") },
      ]);
      return;
    }

    Alert.alert("Change order status?", `${statusLabel(order.status)} → ${statusLabel(target)}`, [
      { text: "Back", style: "cancel" },
      { text: "Confirm", style: target === "CANCELLED" ? "destructive" : "default", onPress: () => applyStatus(target) },
    ]);
  };

  const ship = () => {
    // Dispatch is also the moment a deposit order's collection method is locked in, so the
    // admin is told before, not after.
    const message = balanceDue && partial
      ? `This will ship COD with ${formatPrice(partial.balanceAmount)} to collect at the door. The customer's option to pay the balance online closes immediately.`
      : "Create a Delhivery shipment for this order?";
    Alert.alert("Ship order?", message, [
      { text: "Back", style: "cancel" },
      {
        text: "Ship",
        onPress: () => run("ship", () => AdminOrderService.createShipment(order.id), "Shipment created", "Could not create shipment"),
      },
    ]);
  };

  const cancelShipment = () => {
    Alert.alert("Cancel shipment?", "The waybill will be cancelled with Delhivery.", [
      { text: "Back", style: "cancel" },
      {
        text: "Cancel Shipment",
        style: "destructive",
        onPress: () => run("cancelShipment", () => AdminOrderService.cancelShipment(order.id), "Shipment cancelled", "Could not cancel the shipment"),
      },
    ]);
  };

  const toggleFulfilment = () => {
    const message = manual
      ? "Put this order back on Delhivery? Auto-ship will pick it up again."
      : "Deliver this order locally? It will be skipped by auto-ship, so no Delhivery waybill is created, and you move its status by hand.";
    Alert.alert(manual ? "Use Delhivery?" : "Deliver locally?", message, [
      { text: "Back", style: "cancel" },
      {
        text: "Confirm",
        onPress: () =>
          run(
            "fulfilment",
            () => AdminOrderService.setFulfilmentMode(order.id, !manual),
            manual ? "Back on Delhivery" : "Set to local delivery",
            "Couldn't change the fulfilment mode"
          ),
      },
    ]);
  };

  const openMarkPaid = () => {
    setMethod("CASH");
    setReference("");
    setPaidNote("");
    setMarkPaidOpen(true);
  };

  const submitMarkPaid = async () => {
    const ok = await run(
      "markPaid",
      () =>
        AdminOrderService.markBalancePaid(order.id, {
          method,
          reference: reference.trim() || undefined,
          note: paidNote.trim() || undefined,
        }),
      "Balance recorded",
      "Couldn't record the balance"
    );
    if (ok) setMarkPaidOpen(false);
  };

  const openReturn = (action: "APPROVED" | "REJECTED") => {
    // The route resolves a Return, so it needs the Return's id — not the order's.
    if (!order.returnId) {
      toast.error("No return request found for this order.");
      return;
    }
    setReturnNote("");
    setReturnAction(action);
  };

  const submitReturn = async () => {
    if (!returnAction || !order.returnId) return;
    const ok = await run(
      "return",
      () =>
        AdminOrderService.resolveReturn(order.returnId!, {
          status: returnAction,
          adminNote: returnNote.trim() || undefined,
        }),
      returnAction === "APPROVED" ? "Return approved" : "Return rejected",
      "Could not resolve return"
    );
    if (ok) setReturnAction(null);
  };

  const downloadInvoice = async () => {
    if (busy === "invoice") return;
    setBusy("invoice");
    try {
      await AdminOrderService.downloadInvoice(order.id);
    } catch (e) {
      toast.error(await pdfErrorMessage(e, "Couldn't download the invoice"));
    } finally {
      setBusy(null);
    }
  };

  const addr = order.address;
  // A waybill still live with the courier. Cancelled attempts are FAILED, so a re-ship stays
  // possible — the same test the server applies before shipping or switching to local delivery.
  const hasLiveShipment = order.shipments.some((s) => s.awbCode && s.status !== "FAILED");
  const showShip = !manual && SHIPPABLE.includes(order.status) && !hasLiveShipment;
  // The server cancels the newest shipment, which needs a waybill that hasn't already ended.
  const showCancelShipment =
    !manual &&
    SHIPMENT_CANCELLABLE.includes(order.status) &&
    !!shipment?.awbCode &&
    !["FAILED", "DELIVERED", "RETURNED"].includes(shipment.status);
  const showFulfilmentToggle = FULFILMENT_SWITCHABLE.includes(order.status) && !hasLiveShipment;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="orders" title={`#${shortId(order.id)}`}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
          {/* Status + customer */}
          <Card className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-jakarta-semibold text-text">Status</Text>
              <View className="flex-row items-center gap-1.5">
                {/* How the goods travel is read first, before any courier action. */}
                {manual ? <Badge label="Local delivery" color="amber" /> : null}
                <StatusBadge value={order.status} map={ORDER_STATUS} />
              </View>
            </View>
            <Text className="text-sm text-muted">Placed {formatDateTime(order.createdAt)}</Text>
            <View className="gap-0.5 border-t border-border pt-2">
              <Text className="text-sm font-jakarta-medium text-text">{order.user?.name ?? "Customer"}</Text>
              {order.user?.email ? <Text className="text-sm text-muted">{order.user.email}</Text> : null}
              {order.user?.phone ? <Text className="text-sm text-muted">{order.user.phone}</Text> : null}
            </View>
          </Card>

          {/* Payment */}
          <Card className="gap-1.5">
            <Text className="mb-1 font-jakarta-semibold text-text">Payment</Text>
            <Row label="Total" value={formatPrice(order.total)} strong />
            <Row label="Plan" value={order.paymentPlan === "PARTIAL" ? "Deposit + balance" : "Paid in full"} />
            <Row label="Method" value={order.paymentMethod === "COD" ? "Cash on Delivery" : "Online"} />
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">Payment status</Text>
              {order.payment?.status ? <StatusBadge value={order.payment.status} map={PAYMENT_STATUS} /> : <Text className="text-sm text-text">—</Text>}
            </View>
            {shipment?.awbCode ? (
              <Row label={shipment.courierName ?? "Courier"} value={`AWB ${shipment.awbCode}`} />
            ) : null}
            {shipment?.trackingUrl ? (
              <Text className="text-sm font-jakarta-medium text-primary" onPress={() => Linking.openURL(shipment.trackingUrl!)}>
                Track shipment →
              </Text>
            ) : null}
          </Card>

          {/* Deposit / balance — a partial order's money moves in two legs. */}
          {partial ? (
            <Card className={`gap-1.5 ${balanceDue ? "border border-warning/40" : ""}`}>
              <View className="mb-1 flex-row items-center gap-2">
                <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                <Text className="font-jakarta-semibold text-text">Payment breakdown</Text>
              </View>
              <Row label="Order total" value={formatPrice(order.total)} />
              <Row label="Deposit paid" value={formatPrice(partial.depositAmount)} />
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Balance</Text>
                <Text className={`text-sm font-jakarta-semibold ${partial.balanceStatus === "PAID" ? "text-success" : "text-warning"}`}>
                  {formatPrice(partial.balanceAmount)}
                  {partial.balanceStatus === "PAID"
                    ? ` · paid${partial.balanceMethod ? ` (${partial.balanceMethod.toLowerCase()})` : ""}`
                    : partial.collectedAtDoor
                      ? " · to collect on delivery"
                      : partial.balanceStatus === "WRITTEN_OFF"
                        ? " · written off"
                        : " · outstanding"}
                </Text>
              </View>
              {partial.balanceReference ? <Row label="Reference" value={partial.balanceReference} /> : null}

              {partial.depositForfeited ? (
                <Text className="border-t border-border pt-2 text-xs text-danger">
                  Deposit forfeited — {formatPrice(partial.depositAmount)} retained
                  {partial.depositForfeitedAt ? ` on ${formatDate(partial.depositForfeitedAt)}` : ""}.
                </Text>
              ) : balanceDue ? (
                <View className="border-t border-border pt-2">
                  <Button
                    label="Mark Balance Paid"
                    variant="outline"
                    loading={busy === "markPaid"}
                    onPress={openMarkPaid}
                    left={<Ionicons name="checkmark-done-outline" size={16} color={colors.primary} />}
                  />
                </View>
              ) : null}
            </Card>
          ) : null}

          {addr ? (
            <Card className="gap-0.5">
              <Text className="font-jakarta-semibold text-text">Shipping address</Text>
              <Text className="text-sm text-muted">{addr.name} · {addr.phone}</Text>
              <Text className="text-sm text-muted">
                {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
              </Text>
            </Card>
          ) : null}

          <Card className="gap-3">
            <Text className="font-jakarta-semibold text-text">Items ({order.items.length})</Text>
            {order.items.map((item) => (
              <View key={item.id} className="flex-row items-center gap-3">
                {item.image ? (
                  <Image source={{ uri: item.image }} className="h-12 w-12 rounded-xl" />
                ) : (
                  <View className="h-12 w-12 rounded-xl bg-surface-2" />
                )}
                <View className="flex-1">
                  <Text className="text-sm text-text" numberOfLines={2}>{item.productName}</Text>
                  {item.variantName ? <Text className="text-xs text-muted">{item.variantName}</Text> : null}
                  <Text className="text-xs text-muted">Qty {item.quantity} × {formatPrice(item.price)}</Text>
                </View>
                <Text className="text-sm font-jakarta-semibold text-text">{formatPrice(item.subtotal)}</Text>
              </View>
            ))}

            <View className="gap-1 border-t border-border pt-3">
              <Row label="Subtotal" value={formatPrice(order.subtotal)} />
              {order.discount > 0 ? (
                <Row label={`Discount${order.coupon ? ` (${order.coupon.code})` : ""}`} value={`-${formatPrice(order.discount)}`} />
              ) : null}
              <Row label="Shipping" value={formatPrice(order.shippingCharges)} />
              <Row label="Total" value={formatPrice(order.total)} strong />
            </View>
          </Card>

          {nextStatuses.length > 0 ? (
            <Card className="gap-3">
              <Text className="font-jakarta-semibold text-text">Update status</Text>
              <SelectSheet
                placeholder="Choose the next status"
                value={newStatus ?? ""}
                options={nextStatuses.map((s) => ({ label: statusLabel(s), value: s }))}
                onChange={setNewStatus}
              />
              <Button label="Update Status" loading={busy === "status"} disabled={!newStatus} onPress={updateStatus} />
            </Card>
          ) : null}

          {/* Fulfilment & shipping — courier actions are hidden on a hand-delivered order,
              because the server refuses them. */}
          {showFulfilmentToggle || showShip || showCancelShipment || manual ? (
            <Card className="gap-2">
              <Text className="font-jakarta-semibold text-text">Fulfilment</Text>
              {manual ? (
                <Text className="text-xs text-muted">
                  Delivered locally — skipped by auto-ship. Move the status by hand as it goes out.
                </Text>
              ) : null}
              {showShip ? (
                <>
                  <Button
                    label="Ship Order"
                    loading={busy === "ship"}
                    onPress={ship}
                    left={<Ionicons name="car-outline" size={16} color="#fff" />}
                  />
                  {balanceDue && partial ? (
                    <Text className="text-xs text-warning">
                      Ships COD with {formatPrice(partial.balanceAmount)} to collect at the door.
                    </Text>
                  ) : null}
                </>
              ) : null}
              {showCancelShipment ? (
                <Button label="Cancel Shipment" variant="danger" loading={busy === "cancelShipment"} onPress={cancelShipment} />
              ) : null}
              {showFulfilmentToggle ? (
                <Button
                  label={manual ? "Use Delhivery" : "Deliver Locally"}
                  variant="outline"
                  loading={busy === "fulfilment"}
                  onPress={toggleFulfilment}
                  left={<Ionicons name={manual ? "car-outline" : "home-outline"} size={16} color={colors.primary} />}
                />
              ) : null}
            </Card>
          ) : null}

          <View className="gap-2">
            {/* Only a paid order has an invoice to hand over. */}
            {order.payment?.status === "SUCCESS" ? (
              <Button
                label={busy === "invoice" ? "Preparing invoice…" : "Download Invoice"}
                variant="outline"
                loading={busy === "invoice"}
                onPress={downloadInvoice}
                left={<Ionicons name="document-text-outline" size={16} color={colors.primary} />}
              />
            ) : null}
            {order.status === "RETURN_REQUESTED" ? (
              <>
                <Button label="Approve Return" onPress={() => openReturn("APPROVED")} />
                <Button label="Reject Return" variant="danger" onPress={() => openReturn("REJECTED")} />
              </>
            ) : null}
          </View>
        </ScrollView>
      </AdminShell>

      {/* Mark balance paid — books real money on a person's word. */}
      <Sheet visible={markPaidOpen} onClose={() => (busy === "markPaid" ? null : setMarkPaidOpen(false))} title="Mark balance paid">
        {partial ? (
          <View className="gap-3">
            <Text className="text-sm text-muted">
              Recording <Text className="font-jakarta-semibold text-text">{formatPrice(partial.balanceAmount)}</Text> as collected for this order.
            </Text>
            {order.status !== "DELIVERED" ? (
              <View className="flex-row items-start gap-2 rounded-lg bg-warning/10 px-3 py-2">
                <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                <Text className="flex-1 text-xs text-warning">
                  This order hasn&apos;t been delivered yet ({statusLabel(order.status).toLowerCase()}). Only record an early
                  settlement if you have actually received the money.
                </Text>
              </View>
            ) : null}
            <SelectSheet
              label="How was it collected?"
              value={method}
              options={BALANCE_METHODS}
              onChange={(v) => setMethod(v as BalanceCollectionMethod)}
            />
            <Input
              label="Reference (UTR, receipt no., driver)"
              value={reference}
              onChangeText={setReference}
              maxLength={120}
              autoCapitalize="characters"
            />
            <Input label="Note (optional)" value={paidNote} onChangeText={setPaidNote} maxLength={500} multiline />
            <Button label="Confirm" loading={busy === "markPaid"} onPress={submitMarkPaid} />
          </View>
        ) : null}
      </Sheet>

      {/* Resolve return — with the note web lets an admin leave. */}
      <Sheet
        visible={returnAction !== null}
        onClose={() => (busy === "return" ? null : setReturnAction(null))}
        title={returnAction === "APPROVED" ? "Approve return" : "Reject return"}
      >
        <View className="gap-3">
          <Text className="text-sm text-muted">
            {returnAction === "APPROVED"
              ? "The customer will be told the return is approved, and any online payment is refunded."
              : "The customer will be told the return was not accepted."}
          </Text>
          <Input
            label="Note to record (optional)"
            value={returnNote}
            onChangeText={setReturnNote}
            maxLength={1000}
            multiline
          />
          <Button
            label={returnAction === "APPROVED" ? "Approve Return" : "Reject Return"}
            variant={returnAction === "APPROVED" ? "primary" : "danger"}
            loading={busy === "return"}
            onPress={submitReturn}
          />
        </View>
      </Sheet>
    </ScreenContainer>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className={strong ? "font-jakarta-semibold text-text" : "text-sm text-muted"}>{label}</Text>
      <Text className={strong ? "font-jakarta-semibold text-text" : "text-sm text-text"} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
