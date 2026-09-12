import { useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createVariantBodySchema, updateVariantBodySchema } from "@repo/zod-schema/index";

import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { AdminProductService, type AdminProductVariant, type AdminVariantBody } from "../services/admin.services";
import { ProductImageManager } from "./ProductImageManager";
import { toast } from "../../../store/toast.store";
import { colors } from "../../../theme/tokens";
import { formatPrice } from "../../../lib/utils/format";
import { getErrorMessage } from "../../../lib/utils/errors";

const onlyInt = (v: string) => v.replace(/[^0-9]/g, "");
const onlyDecimal = (v: string) => {
  const cleaned = v.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
};
const str = (v: unknown) => (v != null ? String(v) : "");

/** Editable form state for one variant — strings, as typed. */
interface VariantDraft {
  name: string;
  sku: string;
  price: string;
  salePrice: string;
  isOnSale: boolean;
  stock: string;
  preOrderEnabled: boolean;
  bookingAmount: string;
  preOrderLimit: string;
  partialPaymentEnabled: boolean;
  depositPercent: string;
  codEnabled: boolean;
}

// Per-variant overrides default to inheriting the product: allowed, with the product's terms.
const emptyDraft = (): VariantDraft => ({
  name: "", sku: "", price: "", salePrice: "", isOnSale: false, stock: "",
  preOrderEnabled: true, bookingAmount: "", preOrderLimit: "",
  partialPaymentEnabled: true, depositPercent: "",
  codEnabled: true,
});

const toDraft = (v: AdminProductVariant): VariantDraft => ({
  name: v.name ?? "",
  sku: v.sku ?? "",
  price: str(v.price),
  salePrice: str(v.salePrice),
  isOnSale: v.isOnSale ?? false,
  stock: str(v.stock),
  preOrderEnabled: v.preOrderEnabled ?? true,
  bookingAmount: str(v.bookingAmount),
  preOrderLimit: str(v.preOrderLimit),
  partialPaymentEnabled: v.partialPaymentEnabled ?? true,
  depositPercent: str(v.depositPercent),
  codEnabled: v.codEnabled ?? true,
});

/** Same body as the web editor: blanks become null, which clears an override. */
const buildBody = (d: VariantDraft): AdminVariantBody & { name: string } => ({
  name: d.name.trim(),
  sku: d.sku.trim() ? d.sku.trim() : null,
  price: d.price === "" ? null : Number(d.price),
  salePrice: d.salePrice === "" ? null : Number(d.salePrice),
  isOnSale: d.isOnSale,
  stock: d.stock === "" ? 0 : Number(d.stock),
  preOrderEnabled: d.preOrderEnabled,
  bookingAmount: d.bookingAmount === "" ? null : Number(d.bookingAmount),
  preOrderLimit: d.preOrderLimit === "" ? null : Number(d.preOrderLimit),
  partialPaymentEnabled: d.partialPaymentEnabled,
  depositPercent: d.depositPercent === "" ? null : Number(d.depositPercent),
  codEnabled: d.codEnabled,
});

interface ProductTerms {
  productPreOrderEnabled?: boolean;
  productBookingAmount?: string;
  productPartialPaymentEnabled?: boolean;
  productCodEnabled?: boolean;
}

function SwitchRow({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1 text-sm font-jakarta-medium text-text">{label}</Text>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary }} />
    </View>
  );
}

/** The fields of one variant, shared by the "add" form and the edit form. */
function VariantFields({
  value,
  onChange,
  disabled,
  terms,
}: {
  value: VariantDraft;
  onChange: (patch: Partial<VariantDraft>) => void;
  disabled?: boolean;
  terms: ProductTerms;
}) {
  const stockNum = Number(value.stock || 0);
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <View className="flex-[2]"><Input label="Variant name" placeholder="e.g. Size 5" value={value.name} editable={!disabled} onChangeText={(t) => onChange({ name: t })} /></View>
        <View className="flex-1"><Input label="SKU" placeholder="Optional" value={value.sku} editable={!disabled} autoCapitalize="characters" maxLength={64} onChangeText={(t) => onChange({ sku: t })} /></View>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1"><Input label="Price" placeholder="Base price" keyboardType="decimal-pad" value={value.price} editable={!disabled} onChangeText={(t) => onChange({ price: onlyDecimal(t) })} /></View>
        <View className="flex-1"><Input label="Sale price" placeholder="Optional" keyboardType="decimal-pad" value={value.salePrice} editable={!disabled} onChangeText={(t) => onChange({ salePrice: onlyDecimal(t) })} /></View>
        <View className="flex-1"><Input label="Stock" keyboardType="number-pad" value={value.stock} editable={!disabled} onChangeText={(t) => onChange({ stock: onlyInt(t) })} /></View>
      </View>
      <SwitchRow
        label={stockNum > 0 ? "In stock" : "Out of stock"}
        value={stockNum > 0}
        disabled={disabled}
        onChange={(next) => onChange({ stock: next ? (stockNum > 0 ? value.stock : "1") : "0" })}
      />
      <SwitchRow label="On sale — charge this variant's sale price" value={value.isOnSale} disabled={disabled} onChange={(v) => onChange({ isOnSale: v })} />

      {/* Overrides only make sense once the product itself allows the feature. */}
      {terms.productPreOrderEnabled ? (
        <View className="gap-2 rounded-lg border border-border bg-surface-2 p-2.5">
          <SwitchRow label="Allow pre-orders for this variant" value={value.preOrderEnabled} disabled={disabled} onChange={(v) => onChange({ preOrderEnabled: v })} />
          {value.preOrderEnabled ? (
            <>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Input
                    label="Booking amount (₹)"
                    placeholder={terms.productBookingAmount ? `${terms.productBookingAmount} (product)` : "Same as product"}
                    keyboardType="decimal-pad"
                    value={value.bookingAmount}
                    editable={!disabled}
                    onChangeText={(t) => onChange({ bookingAmount: onlyDecimal(t) })}
                  />
                </View>
                <View className="flex-1">
                  <Input label="Limit" placeholder="Product limit only" keyboardType="number-pad" value={value.preOrderLimit} editable={!disabled} onChangeText={(t) => onChange({ preOrderLimit: onlyInt(t) })} />
                </View>
              </View>
              <Text className="text-[11px] text-faint">Blank uses the product&apos;s booking amount. The product limit still caps the overall total.</Text>
            </>
          ) : null}
        </View>
      ) : null}
      {terms.productPartialPaymentEnabled ? (
        <View className="gap-2 rounded-lg border border-border bg-surface-2 p-2.5">
          <SwitchRow label="Allow partial payment for this variant" value={value.partialPaymentEnabled} disabled={disabled} onChange={(v) => onChange({ partialPaymentEnabled: v })} />
          {value.partialPaymentEnabled ? (
            <Input label="Deposit %" placeholder="Same as product" keyboardType="number-pad" value={value.depositPercent} editable={!disabled} onChangeText={(t) => onChange({ depositPercent: onlyInt(t).slice(0, 2) })} />
          ) : null}
        </View>
      ) : null}
      {terms.productCodEnabled ? (
        <View className="rounded-lg border border-border bg-surface-2 p-2.5">
          <SwitchRow label="Allow Cash on Delivery for this variant" value={value.codEnabled} disabled={disabled} onChange={(v) => onChange({ codEnabled: v })} />
        </View>
      ) : null}
    </View>
  );
}

const firstIssue = (err: { issues: { message: string }[] }) => err.issues[0]?.message ?? "Please check the variant fields";

export function VariantManager({
  productId,
  variants,
  onChange,
  productPreOrderEnabled,
  productBookingAmount,
  productPartialPaymentEnabled,
  productCodEnabled,
}: {
  productId: string;
  variants: AdminProductVariant[];
  onChange: () => void;
} & ProductTerms) {
  const terms: ProductTerms = { productPreOrderEnabled, productBookingAmount, productPartialPaymentEnabled, productCodEnabled };

  const [draft, setDraft] = useState<VariantDraft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<VariantDraft>(emptyDraft);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedImagesId, setExpandedImagesId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const sorted = [...variants].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const add = async () => {
    const body = buildBody(draft);
    const parsed = createVariantBodySchema.safeParse({ productId, ...body });
    if (!parsed.success) return toast.error(firstIssue(parsed.error));
    setAdding(true);
    try {
      await AdminProductService.createVariant(productId, body);
      setDraft(emptyDraft());
      toast.success("Variant added");
      onChange();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not add variant"));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (v: AdminProductVariant) => {
    setEditDraft(toDraft(v));
    setEditingId(v.id);
  };

  const saveEdit = async (id: string) => {
    const body = buildBody(editDraft);
    const parsed = updateVariantBodySchema.safeParse(body);
    if (!parsed.success) return toast.error(firstIssue(parsed.error));
    setSavingId(id);
    try {
      await AdminProductService.updateVariant(id, body);
      toast.success("Variant saved");
      setEditingId(null);
      onChange();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not save variant"));
    } finally {
      setSavingId(null);
    }
  };

  // In/out-of-stock shortcut without opening the editor (off = 0, on = restore/1).
  const setVariantStock = async (v: AdminProductVariant, inStock: boolean) => {
    const newStock = inStock ? (Number(v.stock) > 0 ? Number(v.stock) : 1) : 0;
    setTogglingId(v.id);
    try {
      await AdminProductService.updateVariant(v.id, { stock: newStock });
      onChange();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not update stock"));
    } finally {
      setTogglingId(null);
    }
  };

  // Renumber every variant to its list position and persist the ones that changed.
  const move = async (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (moving || to < 0 || to >= sorted.length) return;
    const next = [...sorted];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved!);
    const changed = next
      .map((v, i) => ({ v, i }))
      .filter(({ v, i }) => (v.sortOrder ?? -1) !== i);
    setMoving(true);
    try {
      const results = await Promise.allSettled(changed.map(({ v, i }) => AdminProductService.updateVariant(v.id, { sortOrder: i })));
      if (results.some((r) => r.status === "rejected")) toast.error("Some variants couldn't be reordered");
      onChange();
    } finally {
      setMoving(false);
    }
  };

  const remove = (id: string) => {
    Alert.alert("Delete variant", "This removes the variant and its images. It can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await AdminProductService.deleteVariant(id);
            if (editingId === id) setEditingId(null);
            onChange();
          } catch (e) {
            toast.error(getErrorMessage(e, "Could not delete variant"));
          }
        },
      },
    ]);
  };

  return (
    <View className="gap-2">
      <Text className="font-jakarta-semibold text-text">Variants</Text>
      {sorted.map((v, i) => {
        const editing = editingId === v.id;
        return (
          <Card key={v.id} className="gap-2 py-2.5">
            <View className="flex-row items-start gap-2">
              <View className="items-center">
                <Pressable onPress={() => move(i, -1)} disabled={i === 0 || moving} hitSlop={6} accessibilityLabel="Move up" className="p-0.5" style={i === 0 ? { opacity: 0.3 } : undefined}>
                  <Ionicons name="chevron-up" size={16} color={colors.muted} />
                </Pressable>
                <Pressable onPress={() => move(i, 1)} disabled={i === sorted.length - 1 || moving} hitSlop={6} accessibilityLabel="Move down" className="p-0.5" style={i === sorted.length - 1 ? { opacity: 0.3 } : undefined}>
                  <Ionicons name="chevron-down" size={16} color={colors.muted} />
                </Pressable>
              </View>
              <View className="flex-1">
                <Text className="font-jakarta-medium text-text">{v.name}</Text>
                <Text className="text-xs text-muted">
                  {v.price != null ? formatPrice(v.price) : "Base price"}
                  {v.isOnSale && v.salePrice != null ? ` · sale ${formatPrice(v.salePrice)}` : ""} · Stock {v.stock}
                  {v.sku ? ` · ${v.sku}` : ""}
                </Text>
                <View className="mt-1 flex-row flex-wrap gap-1">
                  {productPreOrderEnabled && v.preOrderEnabled === false ? <Badge label="No pre-order" color="gray" /> : null}
                  {productPartialPaymentEnabled && v.partialPaymentEnabled === false ? <Badge label="No deposit" color="gray" /> : null}
                  {productCodEnabled && v.codEnabled === false ? <Badge label="No COD" color="gray" /> : null}
                </View>
              </View>
              <Pressable onPress={() => (editing ? setEditingId(null) : startEdit(v))} hitSlop={8} className="p-1" accessibilityLabel={editing ? "Close editor" : "Edit variant"}>
                <Ionicons name={editing ? "close" : "create-outline"} size={19} color={colors.text} />
              </Pressable>
              <Pressable onPress={() => remove(v.id)} hitSlop={8} className="p-1" accessibilityLabel="Delete variant">
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>

            {editing ? (
              <View className="gap-2 border-t border-border pt-2">
                <VariantFields value={editDraft} onChange={(p) => setEditDraft((d) => ({ ...d, ...p }))} disabled={savingId === v.id} terms={terms} />
                <View className="flex-row gap-2">
                  <View className="flex-1"><Button label="Cancel" variant="outline" onPress={() => setEditingId(null)} /></View>
                  <View className="flex-1"><Button label="Save Variant" loading={savingId === v.id} onPress={() => saveEdit(v.id)} /></View>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-jakarta-medium text-text">{Number(v.stock) > 0 ? "In stock" : "Out of stock"}</Text>
                <Switch
                  value={Number(v.stock) > 0}
                  disabled={togglingId === v.id}
                  onValueChange={(next) => setVariantStock(v, next)}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            )}

            <Pressable
              onPress={() => setExpandedImagesId((id) => (id === v.id ? null : v.id))}
              className="flex-row items-center gap-1.5"
            >
              <Ionicons name="image-outline" size={15} color={colors.primary} />
              <Text className="text-sm font-jakarta-medium text-primary">
                {v.images?.length ? `Images (${v.images.length})` : "Add images"}
              </Text>
            </Pressable>
            {expandedImagesId === v.id ? (
              <ProductImageManager productId={productId} variantId={v.id} images={v.images ?? []} onChange={onChange} />
            ) : null}
          </Card>
        );
      })}

      <Card className="gap-2">
        <Text className="font-jakarta-medium text-text">Add a variant</Text>
        <VariantFields value={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} disabled={adding} terms={terms} />
        <Button label="Add Variant" variant="outline" loading={adding} onPress={add} />
      </Card>
    </View>
  );
}
