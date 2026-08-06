import { useState } from "react";
import { Alert, FlatList, Pressable, Switch, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AdminShell } from "../../features/admin/components/AdminShell";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { DateField } from "../../components/ui/DateField";
import { Sheet } from "../../components/ui/Sheet";
import { SelectSheet } from "../../components/ui/SelectSheet";
import { EmptyState } from "../../components/ui/EmptyState";
import { AdminCouponService, type AdminCoupon, type CreateCouponBody } from "../../features/admin/services/admin.services";
import { qk } from "../../lib/api/query-client";
import { toast } from "../../store/toast.store";
import { formatPrice } from "../../lib/utils/format";
import { colors } from "../../theme/tokens";

export default function AdminCoupons() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: qk.adminCoupons, queryFn: () => AdminCouponService.getAll({ limit: 100 }) });
  const coupons = data?.coupons ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENTAGE" | "FLAT">("PERCENTAGE");
  const [value, setValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [validFrom, setValidFrom] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const openForm = (c?: AdminCoupon) => {
    setEditing(c ?? null);
    setCode(c?.code ?? "");
    setType((c?.type as any) ?? "PERCENTAGE");
    setValue(c?.value != null ? String(c.value) : "");
    setMinOrderValue(c?.minOrderValue != null ? String(c.minOrderValue) : "");
    setMaxDiscount(c?.maxDiscount != null ? String(c.maxDiscount) : "");
    setUsageLimit(c?.usageLimit != null ? String(c.usageLimit) : "");
    setValidFrom(c?.validFrom ?? null);
    setValidUntil(c?.validUntil ?? null);
    setIsActive(c?.isActive ?? true);
    setOpen(true);
  };

  const save = async () => {
    if (!code.trim()) return toast.error("Code required");
    if (!value) return toast.error("Value required");
    const body: CreateCouponBody = {
      code: code.trim().toUpperCase(),
      type,
      value: Number(value),
      minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
      maxDiscount: type === "PERCENTAGE" && maxDiscount ? Number(maxDiscount) : undefined,
      usageLimit: usageLimit ? Number(usageLimit) : undefined,
      validFrom: validFrom ?? undefined,
      validUntil: validUntil ?? undefined,
      isActive,
    };
    if (validFrom && validUntil && new Date(validUntil) < new Date(validFrom)) {
      return toast.error("'Valid Until' can't be before 'Valid From'");
    }
    setSaving(true);
    try {
      if (editing) await AdminCouponService.update(editing.id, body);
      else await AdminCouponService.create(body);
      toast.success(editing ? "Coupon updated" : "Coupon created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: qk.adminCoupons });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save coupon");
    } finally {
      setSaving(false);
    }
  };

  const remove = (c: AdminCoupon) => {
    Alert.alert("Delete coupon", `Delete ${c.code}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await AdminCouponService.delete(c.id);
            qc.invalidateQueries({ queryKey: qk.adminCoupons });
          } catch {
            toast.error("Could not delete coupon");
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell
        active="coupons"
        title="Coupons"
        right={<Pressable onPress={() => openForm()} hitSlop={8}><Ionicons name="add-circle" size={26} color={colors.primary} /></Pressable>}
      >
        <FlatList
          data={coupons}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          ListEmptyComponent={isLoading ? null : <EmptyState icon="ticket-outline" title="No coupons" />}
          renderItem={({ item }) => (
            <Card className="gap-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-jakarta-bold text-text">{item.code}</Text>
                <View className={`rounded-full px-2 py-0.5 ${item.isActive ? "bg-success/10" : "bg-border"}`}>
                  <Text className={item.isActive ? "text-xs font-jakarta-medium text-success" : "text-xs text-muted"}>
                    {item.isActive ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>
              <Text className="text-sm text-muted">
                {item.type === "PERCENTAGE" ? `${item.value}% off` : `${formatPrice(item.value)} off`}
                {item.minOrderValue ? ` · min ${formatPrice(item.minOrderValue)}` : ""}
              </Text>
              <Text className="text-xs text-muted">Used {item.usedCount}{item.usageLimit ? ` / ${item.usageLimit}` : ""}</Text>
              <View className="mt-1 flex-row gap-4">
                <Pressable onPress={() => openForm(item)} className="flex-row items-center gap-1">
                  <Ionicons name="create-outline" size={16} color={colors.text} /><Text className="text-sm text-text">Edit</Text>
                </Pressable>
                <Pressable onPress={() => remove(item)} className="flex-row items-center gap-1">
                  <Ionicons name="trash-outline" size={16} color={colors.danger} /><Text className="text-sm text-danger">Delete</Text>
                </Pressable>
              </View>
            </Card>
          )}
        />
      </AdminShell>

      <Sheet visible={open} onClose={() => setOpen(false)} title={editing ? "Edit Coupon" : "New Coupon"}>
        <View className="gap-3">
          <Input label="Code" value={code} onChangeText={setCode} autoCapitalize="characters" />
          <SelectSheet
            label="Type"
            value={type}
            options={[{ label: "Percentage (%)", value: "PERCENTAGE" }, { label: "Flat amount (₹)", value: "FLAT" }]}
            onChange={(v) => setType(v as any)}
          />
          <View className="flex-row gap-2">
            <View className="flex-1"><Input label={type === "PERCENTAGE" ? "Value (%)" : "Value (₹)"} keyboardType="numeric" value={value} onChangeText={setValue} /></View>
            <View className="flex-1"><Input label="Min order (₹)" keyboardType="numeric" value={minOrderValue} onChangeText={setMinOrderValue} /></View>
          </View>
          <View className="flex-row gap-2">
            {type === "PERCENTAGE" ? (
              <View className="flex-1"><Input label="Max discount (₹)" keyboardType="numeric" value={maxDiscount} onChangeText={setMaxDiscount} /></View>
            ) : null}
            <View className="flex-1"><Input label="Usage limit" keyboardType="numeric" value={usageLimit} onChangeText={setUsageLimit} /></View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1"><DateField label="Valid From" value={validFrom} onChange={setValidFrom} placeholder="Any time" /></View>
            <View className="flex-1"><DateField label="Valid Until" value={validUntil} onChange={setValidUntil} placeholder="No expiry" /></View>
          </View>
          <Pressable className="flex-row items-center justify-between" onPress={() => setIsActive((v) => !v)}>
            <Text className="text-text">Active</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.primary }} />
          </Pressable>
          <Button label="Save Coupon" loading={saving} onPress={save} />
        </View>
      </Sheet>
    </ScreenContainer>
  );
}
