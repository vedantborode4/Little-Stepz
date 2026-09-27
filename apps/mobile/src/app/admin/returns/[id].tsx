import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Sheet } from "../../../components/ui/Sheet";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Skeleton } from "../../../components/ui/Skeleton";
import { EmptyState } from "../../../components/ui/EmptyState";
import { QuantityStepper } from "../../../components/ui/QuantityStepper";
import {
  AdminReturnService,
  type AdminReturnDetail,
} from "../../../features/admin/services/admin-returns.service";
import { REFUND_CHANNEL_LABEL, type ReturnRefundRow } from "../../../lib/services/return.service";
import { RETURN_STATUS } from "../../../lib/enums";
import { qk } from "../../../lib/api/query-client";
import { formatDateTime, formatPrice, shortId } from "../../../lib/utils/format";
import { getErrorMessage } from "../../../lib/utils/errors";
import { toast } from "../../../store/toast.store";
import { colors } from "../../../theme/tokens";

// Aligned with web (apps/web/app/admin/returns/[id]/page.tsx)
export default function AdminReturnDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: r, isLoading, refetch } = useQuery({
    queryKey: qk.adminReturn(id),
    queryFn: () => AdminReturnService.get(id),
    enabled: !!id,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [resolve, setResolve] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [settle, setSettle] = useState<ReturnRefundRow | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await refetch();
      qc.invalidateQueries({ queryKey: ["admin", "returns"] });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      return true;
    } catch (e) {
      toast.error(getErrorMessage(e, "Action failed"));
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <AdminShell active="returns" title="Return">
          <View className="gap-3 p-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </View>
        </AdminShell>
      </ScreenContainer>
    );
  }
  if (!r) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <AdminShell active="returns" title="Return">
          <EmptyState icon="alert-circle-outline" title="Return not found" />
        </AdminShell>
      </ScreenContainer>
    );
  }

  const lineAmount = (orderItemId: string) => r.preview?.lines.find((l) => l.orderItemId === orderItemId)?.amount ?? 0;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="returns" title={`Return · #${shortId(r.orderId)}`}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Card className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-jakarta-semibold text-text">Status</Text>
              <StatusBadge value={r.status} map={RETURN_STATUS} />
            </View>
            <Row label="Requested" value={formatDateTime(r.createdAt)} />
            <Row label="Reason" value={r.reason} />
            {r.description ? <Text className="text-sm text-muted">{r.description}</Text> : null}
            <Row label="Customer" value={r.customer?.name ?? "—"} />
            <Row label="Phone" value={r.customer?.phone ?? r.address?.phone ?? "—"} />
            <Row
              label="Payment"
              value={r.order.paymentMethod === "COD" ? "Cash on delivery" : r.order.paymentPlan === "PARTIAL" ? "Deposit + balance" : "Online"}
            />
            {r.refundUpiId ? <Row label="Refund UPI" value={r.refundUpiId} /> : null}
            {!r.refundUpiId && r.preview?.manualRefundLikely ? (
              <Text className="text-xs text-warning">Paid partly in cash but no UPI on file — contact the customer before paying out.</Text>
            ) : null}
            {r.order.isPreOrder ? <Text className="text-xs text-warning">Converted pre-order</Text> : null}
            <Text className="text-sm font-jakarta-medium text-primary" onPress={() => router.push(`/admin/orders/${r.orderId}` as any)}>
              View order →
            </Text>
          </Card>

          <Card className="gap-3">
            <Text className="font-jakarta-semibold text-text">Items</Text>
            {r.items.map((i) => (
              <View key={i.id} className="flex-row gap-3">
                <View className="h-12 w-12 overflow-hidden rounded-md bg-border">
                  {i.image ? <Image source={{ uri: i.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                </View>
                <View className="flex-1">
                  <Text numberOfLines={2} className="text-sm font-jakarta-medium text-text">{i.productName}</Text>
                  <Text className="text-xs text-muted">
                    {i.variantName ? `${i.variantName} · ` : ""}Returning {i.quantity} of {i.orderedQuantity}
                  </Text>
                  {i.acceptedQuantity != null ? (
                    <Text className="text-xs text-muted">Accepted {i.acceptedQuantity}{i.restocked ? " · restocked" : ""}</Text>
                  ) : null}
                </View>
                <Text className="text-sm font-jakarta-medium text-text">{formatPrice(i.refundAmount ?? lineAmount(i.orderItemId))}</Text>
              </View>
            ))}
            <View className="h-px bg-border" />
            <Row label={r.refundAmount != null ? "Refund" : "Estimated refund"} value={formatPrice(r.refundAmount ?? r.estimatedRefund)} strong />
          </Card>

          <Card className="gap-2">
            <Text className="font-jakarta-semibold text-text">Evidence</Text>
            {r.media.length === 0 ? (
              <Text className="text-sm text-warning">No photos or video were attached (request came from an older app version).</Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {r.media.map((m) => (
                  <Pressable key={m.publicId} onPress={() => Linking.openURL(m.url)} className="h-20 w-20 overflow-hidden rounded-md border border-border bg-border">
                    {m.type === "image" ? (
                      <Image source={{ uri: m.url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <View className="flex-1 items-center justify-center"><Ionicons name="play-circle-outline" size={28} color={colors.muted} /></View>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </Card>

          {r.pickupMode ? (
            <Card className="gap-1">
              <Text className="font-jakarta-semibold text-text">Pickup</Text>
              <Text className="text-sm text-muted">
                {r.pickupMode === "DELHIVERY" ? "Delhivery reverse pickup" : "Arranged manually"}
                {r.pickupStatus ? ` · ${r.pickupStatus.toLowerCase().replace(/_/g, " ")}` : ""}
                {r.pickupAwb ? ` · AWB ${r.pickupAwb}` : ""}
              </Text>
              {r.pickupTrackingUrl ? (
                <Text className="text-sm font-jakarta-medium text-primary" onPress={() => Linking.openURL(r.pickupTrackingUrl!)}>Track pickup →</Text>
              ) : null}
            </Card>
          ) : null}

          {r.refunds.length ? (
            <Card className="gap-3">
              <Text className="font-jakarta-semibold text-text">Refunds</Text>
              {r.refunds.map((f) => (
                <View key={f.id} className="gap-1.5">
                  <Row label={REFUND_CHANNEL_LABEL[f.channel] ?? f.channel} value={formatPrice(f.amount)} strong />
                  <Text className="text-xs text-muted">
                    {f.status.toLowerCase()}
                    {f.razorpayRefundId ? ` · ${f.razorpayRefundId}` : ""}
                    {f.manualReference ? ` · ref ${f.manualReference}` : ""}
                  </Text>
                  {f.failureReason ? <Text className="text-xs text-danger">{f.failureReason}</Text> : null}
                  <View className="flex-row gap-2">
                    {f.status === "FAILED" && f.channel !== "MANUAL" ? (
                      <Button
                        label="Retry"
                        size="sm"
                        variant="outline"
                        fullWidth={false}
                        loading={busy === `retry-${f.id}`}
                        onPress={() =>
                          Alert.alert(
                            "Retry refund?",
                            "Check the Razorpay dashboard first: retry only if this payment shows NO refund for this amount.",
                            [
                              { text: "Cancel", style: "cancel" },
                              { text: "Retry", onPress: () => void run(`retry-${f.id}`, () => AdminReturnService.retryRefund(f.id), "Refund retried") },
                            ]
                          )
                        }
                      />
                    ) : null}
                    {f.status !== "PROCESSED" && (f.channel === "MANUAL" || f.status === "FAILED" || f.status === "INITIATED") ? (
                      <Button label={f.channel === "MANUAL" ? "Mark paid" : "Mark settled"} size="sm" variant="outline" fullWidth={false} onPress={() => setSettle(f)} />
                    ) : null}
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          <View className="gap-2">
            {r.status === "PENDING" ? (
              <>
                <Button label="Approve Return" onPress={() => setResolve("APPROVED")} />
                <Button label="Reject Return" variant="danger" onPress={() => setResolve("REJECTED")} />
              </>
            ) : null}
            {r.status === "APPROVED" && !r.pickupMode ? (
              <>
                <Button
                  label="Arrange pickup manually"
                  variant="outline"
                  loading={busy === "manual"}
                  onPress={() => run("manual", () => AdminReturnService.schedulePickup(r.id, "MANUAL"), "Marked as arranged manually")}
                />
                {r.pickupAvailable ? (
                  <Button
                    label="Book Delhivery pickup"
                    variant="outline"
                    loading={busy === "rvp"}
                    onPress={() => run("rvp", () => AdminReturnService.schedulePickup(r.id, "DELHIVERY"), "Delhivery pickup booked")}
                  />
                ) : null}
              </>
            ) : null}
            {r.status === "APPROVED" ? (
              <Button label="Mark picked up" variant="outline" loading={busy === "picked"}
                onPress={() => run("picked", () => AdminReturnService.markPickedUp(r.id), "Marked picked up")} />
            ) : null}
            {r.status === "APPROVED" || r.status === "PICKED_UP" ? (
              <Button label="Receive & inspect" onPress={() => setReceiveOpen(true)} />
            ) : null}
            {r.status === "RECEIVED" ? <Text className="text-center text-xs text-muted">Waiting for the refunds above to settle.</Text> : null}
          </View>
        </ScrollView>
      </AdminShell>

      <ResolveSheet
        action={resolve}
        busy={busy === "resolve"}
        onClose={() => setResolve(null)}
        onSubmit={async (note) => {
          const ok = await run("resolve", () => AdminReturnService.resolve(r.id, resolve!, note), resolve === "APPROVED" ? "Return approved" : "Return rejected");
          if (ok) setResolve(null);
        }}
      />
      {receiveOpen ? (
        <ReceiveSheet
          r={r}
          busy={busy === "receive"}
          onClose={() => setReceiveOpen(false)}
          onSubmit={async (body) => {
            const ok = await run("receive", () => AdminReturnService.receive(r.id, body), "Return received");
            if (ok) setReceiveOpen(false);
          }}
        />
      ) : null}
      <SettleSheet
        key={settle?.id ?? "none"}
        row={settle}
        upi={r.refundUpiId}
        busy={busy === "settle"}
        onClose={() => setSettle(null)}
        onSubmit={async (ref) => {
          const ok = await run("settle", () => AdminReturnService.settleRefund(settle!.id, ref), "Refund settled");
          if (ok) setSettle(null);
        }}
      />
    </ScreenContainer>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className={`flex-1 text-right text-sm ${strong ? "font-jakarta-bold text-text" : "text-text"}`}>{value}</Text>
    </View>
  );
}

function ResolveSheet({ action, busy, onClose, onSubmit }: {
  action: "APPROVED" | "REJECTED" | null; busy: boolean; onClose: () => void; onSubmit: (note?: string) => void;
}) {
  const [note, setNote] = useState("");
  const approve = action === "APPROVED";
  return (
    <Sheet visible={action !== null} onClose={() => (busy ? null : onClose())} title={approve ? "Approve return" : "Reject return"}>
      <Text className="mb-2 text-sm text-muted">
        {approve ? "No money moves yet — the refund is released when you receive and inspect the items." : "The customer is notified with your note."}
      </Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={approve ? "Optional note" : "Reason for rejection"}
        placeholderTextColor={colors.muted}
        multiline
        maxLength={1000}
        textAlignVertical="top"
        className="mb-3 min-h-20 rounded-lg border border-border bg-surface p-3 text-text"
      />
      <Button
        label={approve ? "Approve" : "Reject"}
        variant={approve ? "primary" : "danger"}
        loading={busy}
        disabled={!approve && !note.trim()}
        onPress={() => onSubmit(note.trim() || undefined)}
      />
    </Sheet>
  );
}

function ReceiveSheet({ r, busy, onClose, onSubmit }: {
  r: AdminReturnDetail; busy: boolean; onClose: () => void;
  onSubmit: (body: Parameters<typeof AdminReturnService.receive>[1]) => void;
}) {
  const [items, setItems] = useState(r.items.map((i) => ({ returnItemId: i.id, acceptedQuantity: i.quantity, restock: true })));
  const [refundShipping, setRefundShipping] = useState(Boolean(r.preview?.shippingDefaultOn && (r.preview?.shippingRefundable ?? 0) > 0));
  const [override, setOverride] = useState("");
  const [note, setNote] = useState("");

  // An estimate only: the server computes the authoritative amount with the same rules.
  const estimate = Math.min(
    r.items.reduce((s, i, idx) => {
      const full = r.preview?.lines.find((l) => l.orderItemId === i.orderItemId)?.amount ?? 0;
      return s + (i.quantity ? (full * items[idx]!.acceptedQuantity) / i.quantity : 0);
    }, 0) + (refundShipping ? r.preview?.shippingRefundable ?? 0 : 0),
    r.preview?.refundCapacity ?? Infinity
  );
  const nothingAccepted = items.every((d) => d.acceptedQuantity === 0);
  const overrideValue = override.trim() === "" ? undefined : Number(override);
  const overrideInvalid = overrideValue !== undefined && (!Number.isFinite(overrideValue) || overrideValue < 0);
  const update = (idx: number, patch: Partial<(typeof items)[number]>) =>
    setItems((list) => list.map((d, i) => (i === idx ? { ...d, ...patch } : d)));

  return (
    <Sheet visible onClose={() => (busy ? null : onClose())} title="Receive & inspect">
      <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
        {r.items.map((i, idx) => (
          <View key={i.id} className="gap-2 rounded-lg border border-border p-3">
            <Text className="text-sm font-jakarta-medium text-text">{i.productName}{i.variantName ? ` · ${i.variantName}` : ""}</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">Accepted (of {i.quantity})</Text>
              <QuantityStepper value={items[idx]!.acceptedQuantity} min={0} max={i.quantity} onChange={(v) => update(idx, { acceptedQuantity: v })} />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">Put back in stock</Text>
              <Switch value={items[idx]!.restock} onValueChange={(v) => update(idx, { restock: v })} />
            </View>
          </View>
        ))}

        {(r.preview?.shippingRefundable ?? 0) > 0 ? (
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-sm text-muted">
              Refund shipping ({formatPrice(r.preview!.shippingRefundable)}) — seller error only; applies if every unit is accepted.
            </Text>
            <Switch value={refundShipping} onValueChange={setRefundShipping} />
          </View>
        ) : null}

        <View className="gap-2 rounded-lg bg-border/40 p-3">
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted">Estimated refund</Text>
            <Text className="font-jakarta-bold text-text">{formatPrice(nothingAccepted ? 0 : estimate)}</Text>
          </View>
          {nothingAccepted ? (
            <Text className="text-xs text-danger">Nothing accepted — the return closes as failed inspection with no refund.</Text>
          ) : (
            <TextInput
              value={override}
              onChangeText={setOverride}
              keyboardType="decimal-pad"
              placeholder={`Lower amount (optional) — blank for ${formatPrice(estimate)}`}
              placeholderTextColor={colors.muted}
              className="rounded-lg border border-border bg-surface p-3 text-text"
            />
          )}
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={nothingAccepted || overrideValue !== undefined ? "Inspection note (shown to the customer)" : "Inspection note (optional)"}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={1000}
          textAlignVertical="top"
          className="min-h-16 rounded-lg border border-border bg-surface p-3 text-text"
        />

        <Button
          label="Confirm receipt & refund"
          loading={busy}
          disabled={overrideInvalid || ((nothingAccepted || overrideValue !== undefined) && !note.trim())}
          onPress={() => onSubmit({ items, refundShipping, refundAmount: overrideValue, inspectionNote: note.trim() || undefined })}
        />
      </ScrollView>
    </Sheet>
  );
}

function SettleSheet({ row, upi, busy, onClose, onSubmit }: {
  row: ReturnRefundRow | null; upi: string | null; busy: boolean; onClose: () => void; onSubmit: (reference: string) => void;
}) {
  const [ref, setRef] = useState("");
  return (
    <Sheet visible={row !== null} onClose={() => (busy ? null : onClose())} title={row?.channel === "MANUAL" ? "Record manual payout" : "Mark refund settled"}>
      {row ? (
        <>
          <Text className="mb-2 text-sm text-muted">
            {row.channel === "MANUAL"
              ? `Pay ${formatPrice(row.amount)}${upi ? ` to ${upi}` : ""}, then enter the UPI transaction reference.`
              : `Only if you refunded ${formatPrice(row.amount)} directly in the Razorpay dashboard. Enter the refund id.`}
          </Text>
          <TextInput
            value={ref}
            onChangeText={setRef}
            placeholder="Reference"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            className="mb-3 rounded-lg border border-border bg-surface p-3 text-text"
          />
          <Button label="Confirm" loading={busy} disabled={ref.trim().length < 3} onPress={() => onSubmit(ref.trim())} />
        </>
      ) : null}
    </Sheet>
  );
}
