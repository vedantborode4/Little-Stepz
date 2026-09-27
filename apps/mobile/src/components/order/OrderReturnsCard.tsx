import { useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import { RETURN_STATUS } from "../../lib/enums";
import { ReturnService, type ReturnRequest } from "../../lib/services/return.service";
import { formatPrice, formatDate } from "../../lib/utils/format";
import { getErrorMessage } from "../../lib/utils/errors";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

// Aligned with web (apps/web/components/orders/returns/OrderReturnsSection.tsx)
function nextStepCopy(r: ReturnRequest): string | null {
  switch (r.status) {
    case "PENDING": return "We're reviewing your request (2–3 business days).";
    case "APPROVED":
      return r.pickupStatus === "SCHEDULED"
        ? "Collection is arranged. Keep the items packed and ready."
        : "Approved. We'll arrange collection of the items.";
    case "PICKED_UP": return "Collected. We'll inspect the items as soon as they reach us.";
    case "RECEIVED": return "Received and inspected. Your refund is being processed.";
    case "REFUNDED": return r.refundAmount ? `Refunded ${formatPrice(r.refundAmount)}.` : "Completed.";
    case "INSPECTION_FAILED": return "The items didn't pass inspection, so no refund is due.";
    case "REJECTED": return "This return wasn't approved.";
    default: return null;
  }
}

export function OrderReturnsCard({
  orderId,
  returns,
  onChanged,
}: {
  orderId: string;
  returns: ReturnRequest[];
  onChanged: () => void;
}) {
  const [cancelling, setCancelling] = useState<string | null>(null);
  if (returns.length === 0) return null;

  const cancel = (id: string) =>
    Alert.alert("Cancel return?", "Your return request will be withdrawn.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel return",
        style: "destructive",
        onPress: async () => {
          setCancelling(id);
          try {
            await ReturnService.cancel(orderId, id);
            toast.success("Return cancelled");
            onChanged();
          } catch (e) {
            toast.error(getErrorMessage(e, "Couldn't cancel the return"));
          } finally {
            setCancelling(null);
          }
        },
      },
    ]);

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name="return-down-back-outline" size={18} color={colors.primary} />
        <Text className="font-jakarta-semibold text-text">Returns</Text>
      </View>
      {returns.map((r) => (
        <View key={r.id} className="gap-2 rounded-lg border border-border p-3">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text className="text-sm font-jakarta-medium text-text">{r.reason}</Text>
              <Text className="text-xs text-muted">Requested {formatDate(r.createdAt)}</Text>
            </View>
            <StatusBadge value={r.status} map={RETURN_STATUS} />
          </View>
          {r.items.map((i) => (
            <Text key={i.id} numberOfLines={1} className="text-sm text-muted">
              {i.productName}{i.variantName ? ` (${i.variantName})` : ""} × {i.quantity}
              {i.acceptedQuantity != null && i.acceptedQuantity < i.quantity ? ` · ${i.acceptedQuantity} accepted` : ""}
            </Text>
          ))}
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted">{r.refundAmount != null ? "Refund" : "Estimated refund"}</Text>
            <Text className="text-sm font-jakarta-semibold text-text">{formatPrice(r.refundAmount ?? r.estimatedRefund)}</Text>
          </View>
          {nextStepCopy(r) ? <Text className="text-xs text-muted">{nextStepCopy(r)}</Text> : null}
          {r.adminNote && (r.status === "REJECTED" || r.status === "INSPECTION_FAILED") ? (
            <Text className="text-xs text-muted">Note: {r.adminNote}</Text>
          ) : null}
          {r.inspectionNote && r.status === "INSPECTION_FAILED" ? (
            <Text className="text-xs text-muted">Inspection: {r.inspectionNote}</Text>
          ) : null}
          {r.pickupTrackingUrl ? (
            <Button label="Track pickup" variant="outline" size="sm" onPress={() => Linking.openURL(r.pickupTrackingUrl!)} />
          ) : null}
          {r.canCancel ? (
            <Button label="Cancel return" variant="ghost" size="sm" loading={cancelling === r.id} onPress={() => cancel(r.id)} />
          ) : null}
        </View>
      ))}
    </Card>
  );
}
