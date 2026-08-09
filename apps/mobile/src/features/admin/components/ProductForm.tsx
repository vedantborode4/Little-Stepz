import { useRef, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { SelectSheet } from "../../../components/ui/SelectSheet";
import { RichTextEditor } from "./RichTextEditor";
import {
  AdminProductService,
  AdminCategoryService,
  type AdminProduct,
  type PriceDisplayMode,
  type ProductSpec,
} from "../services/admin.services";
import { qk } from "../../../lib/api/query-client";
import { toast } from "../../../store/toast.store";
import { colors } from "../../../theme/tokens";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const PRICE_DISPLAY_OPTIONS: { label: string; value: PriceDisplayMode }[] = [
  { label: "Sale + strikethrough regular", value: "BOTH" },
  { label: "Regular price only", value: "REGULAR" },
  { label: "Sale price only", value: "SALE" },
];

export function ProductForm({
  product,
  onSaved,
}: {
  product?: AdminProduct;
  onSaved: (p: AdminProduct) => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [longDescription, setLongDescription] = useState(product?.longDescription ?? "");
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : "");
  const [salePrice, setSalePrice] = useState(product?.salePrice != null ? String(product.salePrice) : "");
  const [isOnSale, setIsOnSale] = useState(product?.isOnSale ?? false);
  const [priceDisplay, setPriceDisplay] = useState<PriceDisplayMode>(product?.priceDisplay ?? "BOTH");
  const [costPrice, setCostPrice] = useState(product?.costPrice != null ? String(product.costPrice) : "");
  const [quantity, setQuantity] = useState(product?.quantity != null ? String(product.quantity) : "");
  const [inStock, setInStock] = useState(product?.inStock ?? true);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? product?.category?.id ?? "");
  const [specs, setSpecs] = useState<ProductSpec[]>(product?.specifications ?? []);
  const [saving, setSaving] = useState(false);

  const lastQtyRef = useRef("1");
  const toggleStock = (next: boolean) => {
    setInStock(next);
    if (next) {
      if ((Number(quantity) || 0) <= 0) setQuantity(Number(lastQtyRef.current) > 0 ? lastQtyRef.current : "1");
    } else {
      if ((Number(quantity) || 0) > 0) lastQtyRef.current = quantity;
      setQuantity("0");
    }
  };

  const setSpec = (i: number, key: keyof ProductSpec, val: string) =>
    setSpecs((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const addSpec = () => setSpecs((rows) => [...rows, { label: "", value: "" }]);
  const removeSpec = (i: number) => setSpecs((rows) => rows.filter((_, idx) => idx !== i));

  const categories = useQuery({ queryKey: qk.adminCategories, queryFn: () => AdminCategoryService.getAll() });
  const categoryOptions = (categories.data ?? []).map((c) => ({ label: c.name, value: c.id }));

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!price) return toast.error("Price is required");
    if (!categoryId) return toast.error("Select a category");

    const priceNum = Number(price);
    const saleNum = salePrice ? Number(salePrice) : undefined;
    if (isOnSale) {
      if (saleNum == null) return toast.error("Enter a sale price or turn off 'On sale'");
      if (saleNum >= priceNum) return toast.error("Sale price must be lower than the regular price");
      if (priceDisplay === "REGULAR") return toast.error("'Regular only' can't be used while on sale");
    }

    const cleanedSpecs = specs
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter((s) => s.label && s.value);

    const shared = {
      salePrice: saleNum ?? null,
      isOnSale,
      priceDisplay,
      specifications: cleanedSpecs,
    };

    setSaving(true);
    try {
      let saved: AdminProduct;
      const base = {
        name,
        slug: slug.trim() || slugify(name),
        description,
        longDescription,
        price: priceNum,
        costPrice: costPrice ? Number(costPrice) : undefined,
        quantity: Number(quantity) || 0,
        inStock,
        categoryId,
        ...shared,
      };
      if (product) {
        saved = await AdminProductService.updateProduct(product.id, base);
      } else {
        saved = await AdminProductService.createProduct(base);
      }
      toast.success(product ? "Product updated" : "Product created");
      onSaved(saved);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="gap-3">
      <Input label="Name" value={name} onChangeText={(t) => { setName(t); if (!product) setSlug(slugify(t)); }} />
      <Input label="Slug" value={slug} onChangeText={setSlug} autoCapitalize="none" />
      <Input label="Short Description" value={description ?? ""} onChangeText={setDescription} multiline />
      <RichTextEditor value={longDescription ?? ""} onChange={setLongDescription} />

      <View className="flex-row gap-2">
        <View className="flex-1"><Input label="Price (₹)" keyboardType="numeric" value={price} onChangeText={setPrice} /></View>
        <View className="flex-1"><Input label="Quantity" keyboardType="numeric" value={quantity} onChangeText={(t) => { setQuantity(t); setInStock((Number(t) || 0) > 0); }} /></View>
      </View>

      {/* Sale pricing */}
      <View className="gap-3 rounded-lg border border-border bg-surface p-3">
        <Pressable className="flex-row items-center justify-between" onPress={() => setIsOnSale(!isOnSale)}>
          <View>
            <Text className="text-text">On sale</Text>
            <Text className="text-xs text-faint">Show a discounted price to customers.</Text>
          </View>
          <Switch value={isOnSale} onValueChange={setIsOnSale} trackColor={{ true: colors.primary }} />
        </Pressable>
        {isOnSale ? (
          <>
            <Input label="Sale Price (₹) — must be below the regular price" keyboardType="numeric" value={salePrice} onChangeText={setSalePrice} />
            <SelectSheet label="Price display" value={priceDisplay} options={PRICE_DISPLAY_OPTIONS} onChange={(v) => setPriceDisplay(v as PriceDisplayMode)} />
          </>
        ) : null}
      </View>

      <Input label="Cost Price (₹) — for exact P&L" keyboardType="numeric" value={costPrice} onChangeText={setCostPrice} />
      <SelectSheet label="Category" placeholder="Select category" value={categoryId} options={categoryOptions} onChange={setCategoryId} />

      {/* Specifications */}
      <View className="gap-2 rounded-lg border border-border bg-surface p-3">
        <Text className="font-jakarta-semibold text-text">Specifications</Text>
        <Text className="text-xs text-faint">Label/value rows shown as a table on the product page.</Text>
        {specs.map((s, i) => (
          <View key={i} className="flex-row items-end gap-2">
            <View className="flex-1"><Input label={i === 0 ? "Label" : ""} placeholder="e.g. Material" value={s.label} onChangeText={(t) => setSpec(i, "label", t)} /></View>
            <View className="flex-1"><Input label={i === 0 ? "Value" : ""} placeholder="e.g. ABS plastic" value={s.value} onChangeText={(t) => setSpec(i, "value", t)} /></View>
            <Pressable onPress={() => removeSpec(i)} hitSlop={8} className="mb-3 p-1">
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        <Button label="+ Add specification" variant="outline" onPress={addSpec} />
      </View>

      <Pressable className="flex-row items-center justify-between rounded-lg border border-border bg-surface px-3 py-3" onPress={() => toggleStock(!inStock)}>
        <View>
          <Text className="text-text">{inStock ? "In stock" : "Out of stock"}</Text>
          <Text className="text-xs text-faint">Off sets quantity to 0; on restores it.</Text>
        </View>
        <Switch value={inStock} onValueChange={toggleStock} trackColor={{ true: colors.primary }} />
      </Pressable>

      <Button label={product ? "Save Product Details" : "Create Product"} loading={saving} onPress={save} />
      {product ? (
        <Text className="text-xs text-muted">
          Saves product details only. Variants and images are saved in their own sections below.
        </Text>
      ) : null}
    </View>
  );
}
