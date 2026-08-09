import { useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { AdminProductService, type AdminProductVariant } from "../services/admin.services";
import { ProductImageManager } from "./ProductImageManager";
import { toast } from "../../../store/toast.store";
import { colors } from "../../../theme/tokens";
import { formatPrice } from "../../../lib/utils/format";

const onlyInt = (v: string) => v.replace(/[^0-9]/g, "");
const onlyDecimal = (v: string) => {
  const cleaned = v.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
};

export function VariantManager({
  productId,
  variants,
  onChange,
}: {
  productId: string;
  variants: AdminProductVariant[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [isOnSale, setIsOnSale] = useState(false);
  const [stock, setStock] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // In/out-of-stock shortcut for the "add new" row: off = 0, on = 1 (when empty).
  const toggleNewStock = (next: boolean) => {
    if (next) { if ((Number(stock) || 0) <= 0) setStock("1"); }
    else setStock("0");
  };

  // Flip an existing variant in/out of stock (off = 0, on = restore/1) via the API.
  const setVariantStock = async (v: AdminProductVariant, inStock: boolean) => {
    const newStock = inStock ? (Number(v.stock) > 0 ? Number(v.stock) : 1) : 0;
    setTogglingId(v.id);
    try {
      await AdminProductService.updateVariant(v.id, { stock: newStock });
      onChange();
    } catch {
      toast.error("Could not update stock");
    } finally {
      setTogglingId(null);
    }
  };

  const add = async () => {
    if (!name.trim()) return toast.error("Variant name required");
    if (isOnSale && !salePrice) return toast.error("Set a sale price to put this variant on sale");
    if ((isOnSale || salePrice) && !price) return toast.error("Set the variant's regular price to use its own sale price");
    setAdding(true);
    try {
      await AdminProductService.createVariant(productId, {
        name: name.trim(),
        price: price ? Number(price) : null,
        salePrice: salePrice ? Number(salePrice) : null,
        isOnSale,
        stock: stock ? Number(stock) : 0,
      });
      setName(""); setPrice(""); setSalePrice(""); setIsOnSale(false); setStock("");
      toast.success("Variant added");
      onChange();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not add variant");
    } finally {
      setAdding(false);
    }
  };

  const remove = (id: string) => {
    Alert.alert("Delete variant", "Remove this variant?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await AdminProductService.deleteVariant(id);
            onChange();
          } catch {
            toast.error("Could not delete variant");
          }
        },
      },
    ]);
  };

  return (
    <View className="gap-2">
      <Text className="font-jakarta-semibold text-text">Variants</Text>
      {variants.map((v) => (
        <Card key={v.id} className="gap-2 py-2">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-jakarta-medium text-text">{v.name}</Text>
              <Text className="text-xs text-muted">
                {v.price != null ? formatPrice(v.price) : "Base price"} · Stock {v.stock}
              </Text>
            </View>
            <Ionicons name="trash-outline" size={18} color={colors.danger} onPress={() => remove(v.id)} />
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-jakarta-medium text-text">
              {Number(v.stock) > 0 ? "In stock" : "Out of stock"}
            </Text>
            <Switch
              value={Number(v.stock) > 0}
              disabled={togglingId === v.id}
              onValueChange={(next) => setVariantStock(v, next)}
              trackColor={{ true: colors.primary }}
            />
          </View>
          <Pressable
            onPress={() => setExpandedId((id) => (id === v.id ? null : v.id))}
            className="flex-row items-center gap-1.5"
          >
            <Ionicons name="image-outline" size={15} color={colors.primary} />
            <Text className="text-sm font-jakarta-medium text-primary">
              {v.images?.length ? `Images (${v.images.length})` : "Add images"}
            </Text>
          </Pressable>
          {expandedId === v.id ? (
            <ProductImageManager
              productId={productId}
              variantId={v.id}
              images={v.images ?? []}
              onChange={onChange}
            />
          ) : null}
        </Card>
      ))}
      <Card className="gap-2">
        <Input label="Variant name" placeholder="e.g. Size 5" value={name} onChangeText={setName} />
        <View className="flex-row gap-2">
          <View className="flex-1"><Input label="Price (optional)" keyboardType="decimal-pad" value={price} onChangeText={(t) => setPrice(onlyDecimal(t))} /></View>
          <View className="flex-1"><Input label="Sale price (optional)" keyboardType="decimal-pad" value={salePrice} onChangeText={(t) => setSalePrice(onlyDecimal(t))} /></View>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="flex-1"><Input label="Stock" keyboardType="number-pad" value={stock} onChangeText={(t) => setStock(onlyInt(t))} /></View>
          <View className="flex-1 flex-row items-center justify-between pt-5">
            <Text className="text-sm font-jakarta-medium text-text">{Number(stock) > 0 ? "In stock" : "Out of stock"}</Text>
            <Switch value={Number(stock) > 0} onValueChange={toggleNewStock} trackColor={{ true: colors.primary }} />
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-jakarta-medium text-text">On sale</Text>
          <Switch value={isOnSale} onValueChange={setIsOnSale} />
        </View>
        <Button label="Add Variant" variant="outline" loading={adding} onPress={add} />
      </Card>
    </View>
  );
}
