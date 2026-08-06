import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AdminShell } from "../../features/admin/components/AdminShell";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { SelectSheet } from "../../components/ui/SelectSheet";
import { EntityPicker } from "../../components/notifications/EntityPicker";
import {
  NotificationService,
  type BroadcastTarget,
} from "../../lib/services/notification.service";
import { toast } from "../../store/toast.store";
import { useThemeColors } from "../../theme/useThemeColors";
import type { TargetSearchKind, TargetSearchResult } from "../../types/notification";

type TargetType = BroadcastTarget["type"];
type Tab = "send" | "history";

const TARGET_OPTIONS: { label: string; value: TargetType }[] = [
  { label: "All users", value: "ALL" },
  { label: "By role", value: "ROLE" },
  { label: "A specific user", value: "USER" },
  { label: "Product buyers", value: "PRODUCT_BUYERS" },
  { label: "An order's buyer", value: "ORDER" },
];

const ROLE_OPTIONS = [
  { label: "Customers (USER)", value: "USER" },
  { label: "Affiliates", value: "AFFILIATE" },
  { label: "Admins", value: "ADMIN" },
];

const MARKETING_TARGETS: TargetType[] = ["ALL", "ROLE", "PRODUCT_BUYERS"];

const PICKER_KIND: Record<"USER" | "PRODUCT_BUYERS" | "ORDER", TargetSearchKind> = {
  USER: "user",
  PRODUCT_BUYERS: "product",
  ORDER: "order",
};

function Compose() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("ALL");
  const [role, setRole] = useState<"USER" | "AFFILIATE" | "ADMIN">("USER");
  const [entity, setEntity] = useState<TargetSearchResult | null>(null);
  const [sending, setSending] = useState(false);

  const needsId = targetType === "USER" || targetType === "PRODUCT_BUYERS" || targetType === "ORDER";
  const pickerLabel =
    targetType === "USER" ? "Choose a user" : targetType === "PRODUCT_BUYERS" ? "Choose a product" : "Choose an order";
  const deliversAsMarketing = MARKETING_TARGETS.includes(targetType);

  const buildTarget = (): BroadcastTarget | null => {
    switch (targetType) {
      case "ALL":
        return { type: "ALL" };
      case "ROLE":
        return { type: "ROLE", role };
      case "USER":
        return entity ? { type: "USER", userId: entity.id } : null;
      case "PRODUCT_BUYERS":
        return entity ? { type: "PRODUCT_BUYERS", productId: entity.id } : null;
      case "ORDER":
        return entity ? { type: "ORDER", orderId: entity.id } : null;
    }
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Title and message are required");
    const target = buildTarget();
    if (!target) return toast.error("Please select a target");

    setSending(true);
    try {
      const res = await NotificationService.broadcast({ title: title.trim(), body: body.trim(), target });
      toast.success(`Sent to ${res.recipientCount} recipient${res.recipientCount === 1 ? "" : "s"}`);
      setTitle("");
      setBody("");
      setEntity(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="gap-4">
      <Input label="Title" value={title} onChangeText={setTitle} maxLength={120} placeholder="Weekend Sale is live 🎉" />
      <Input
        label="Message"
        value={body}
        onChangeText={setBody}
        maxLength={500}
        placeholder="What do you want to tell them?"
        multiline
        numberOfLines={4}
        style={{ minHeight: 96, textAlignVertical: "top" }}
      />
      <SelectSheet label="Send to" value={targetType} options={TARGET_OPTIONS} onChange={(v) => { setTargetType(v as TargetType); setEntity(null); }} />

      {targetType === "ROLE" ? (
        <SelectSheet label="Role" value={role} options={ROLE_OPTIONS} onChange={(v) => setRole(v as typeof role)} />
      ) : null}

      {needsId ? (
        <EntityPicker
          kind={PICKER_KIND[targetType as "USER" | "PRODUCT_BUYERS" | "ORDER"]}
          label={pickerLabel}
          value={entity}
          onChange={setEntity}
        />
      ) : null}

      <Text className="text-xs text-muted">
        {deliversAsMarketing
          ? "Delivered as a promotional notification — users who opted out of marketing won't get a push."
          : "Delivered as a direct message — always sent, regardless of marketing preference."}
      </Text>

      <Button label="Send notification" loading={sending} onPress={send} />
    </Card>
  );
}

function History() {
  const colors = useThemeColors();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "broadcasts"],
    queryFn: () => NotificationService.broadcastHistory({ page: 1, limit: 30 }),
  });
  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <View className="py-10">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (items.length === 0) {
    return <Text className="py-10 text-center text-sm text-muted">Nothing sent yet</Text>;
  }

  return (
    <View className="gap-2">
      {items.map((b) => (
        <Card key={b.id} className="gap-1">
          <Text className="font-jakarta-semibold text-text">{b.title}</Text>
          <Text className="text-sm text-muted" numberOfLines={2}>{b.body}</Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2">
            <Ionicons name="people-outline" size={13} color={colors.muted} />
            <Text className="text-xs text-muted">{b.recipientCount} recipient{b.recipientCount === 1 ? "" : "s"}</Text>
            {b.targetLabel ? <Text className="text-xs text-muted">· {b.targetLabel}</Text> : null}
            <Text className="text-xs text-muted">
              · {new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

export default function AdminNotifications() {
  const [tab, setTab] = useState<Tab>("send");

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="notifications" title="Notifications">
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row gap-1.5 self-start rounded-xl border border-border bg-surface-2 p-1.5">
            {(["send", "history"] as const).map((t) => {
              const on = tab === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  className={`rounded-lg px-4 py-2 ${on ? "bg-surface" : ""}`}
                >
                  <Text className={on ? "text-sm font-jakarta-semibold text-primary" : "text-sm font-jakarta-medium text-muted"}>
                    {t === "send" ? "Send" : "History"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tab === "send" ? <Compose /> : <History />}
        </ScrollView>
      </AdminShell>
    </ScreenContainer>
  );
}
