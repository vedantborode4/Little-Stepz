import { useRef, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { createProductSchema } from "@repo/zod-schema/index";

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
import { getErrorMessage } from "../../../lib/utils/errors";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const onlyInt = (v: string) => v.replace(/[^0-9]/g, "");
const onlyDecimal = (v: string) => {
  const cleaned = v.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
};
const str = (v: unknown) => (v != null ? String(v) : "");

const PRICE_DISPLAY_OPTIONS: { label: string; value: PriceDisplayMode }[] = [
  { label: "Sale + strikethrough regular", value: "BOTH" },
  { label: "Regular price only", value: "REGULAR" },
  { label: "Sale price only", value: "SALE" },
];

const CONDITION_OPTIONS = [
  { label: "New", value: "new" },
  { label: "Refurbished", value: "refurbished" },
  { label: "Used", value: "used" },
];

/** Google shows ~60 title characters and ~160 description characters. */
const TITLE_MAX = 60;
const DESC_MAX = 160;

function Counter({ n, max }: { n: number; max: number }) {
  const cls = n > max ? "text-danger" : n > max * 0.9 ? "text-warning" : "text-faint";
  return <Text className={`text-xs ${cls}`}>{n}/{max}</Text>;
}

/** A labelled switch row, the building block of the optional sections below. */
function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable className="flex-row items-center justify-between gap-3" onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View className="flex-1">
        <Text className="text-text">{title}</Text>
        {subtitle ? <Text className="text-xs text-faint">{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </Pressable>
  );
}

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
  const [price, setPrice] = useState(str(product?.price));
  const [salePrice, setSalePrice] = useState(str(product?.salePrice));
  const [isOnSale, setIsOnSale] = useState(product?.isOnSale ?? false);
  const [priceDisplay, setPriceDisplay] = useState<PriceDisplayMode>(product?.priceDisplay ?? "BOTH");
  const [costPrice, setCostPrice] = useState(str(product?.costPrice));
  const [quantity, setQuantity] = useState(str(product?.quantity));
  const [inStock, setInStock] = useState(product?.inStock ?? true);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? product?.category?.id ?? "");
  const [specs, setSpecs] = useState<ProductSpec[]>(product?.specifications ?? []);

  // Pre-order
  const [preOrderEnabled, setPreOrderEnabled] = useState(product?.preOrderEnabled ?? false);
  const [bookingAmount, setBookingAmount] = useState(str(product?.bookingAmount));
  const [preOrderLimit, setPreOrderLimit] = useState(str(product?.preOrderLimit));
  const [preOrderNote, setPreOrderNote] = useState(product?.preOrderNote ?? "");
  // Partial payment + COD
  const [partialPaymentEnabled, setPartialPaymentEnabled] = useState(product?.partialPaymentEnabled ?? false);
  const [depositPercent, setDepositPercent] = useState(str(product?.depositPercent));
  const [codEnabled, setCodEnabled] = useState(product?.codEnabled ?? false);
  // SEO + Google Shopping
  const [metaTitle, setMetaTitle] = useState(product?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(product?.metaDescription ?? "");
  const [ogImage, setOgImage] = useState(product?.ogImage ?? "");
  const [noindex, setNoindex] = useState(product?.noindex ?? false);
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [gtin, setGtin] = useState(product?.gtin ?? "");
  const [mpn, setMpn] = useState(product?.mpn ?? "");
  const [condition, setCondition] = useState<string>(product?.condition ?? "new");
  const [seoOpen, setSeoOpen] = useState(false);

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

    const cleanedSpecs = specs
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter((s) => s.label && s.value);

    // Mirrors the web editor's payload: blank optional fields are omitted (the API's
    // optional numbers coerce null/"" into invalid values), except the deposit percent,
    // where null deliberately means "use the store-wide default".
    const payload = {
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      description,
      longDescription: longDescription === "<p></p>" ? "" : longDescription,
      price: Number(price),
      salePrice: salePrice ? Number(salePrice) : undefined,
      costPrice: costPrice ? Number(costPrice) : undefined,
      isOnSale,
      priceDisplay,
      quantity: Number(quantity) || 0,
      inStock,
      categoryId,
      specifications: cleanedSpecs,
      preOrderEnabled,
      bookingAmount: bookingAmount ? Number(bookingAmount) : undefined,
      preOrderLimit: preOrderLimit ? Number(preOrderLimit) : undefined,
      preOrderNote: preOrderNote.trim() || undefined,
      partialPaymentEnabled,
      depositPercent: depositPercent ? Number(depositPercent) : null,
      codEnabled,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      ogImage: ogImage.trim() || undefined,
      noindex,
      brand: brand.trim() || undefined,
      gtin: gtin.trim() || undefined,
      mpn: mpn.trim() || undefined,
      condition: condition as "new" | "used" | "refurbished",
    };

    // The same schema the API validates with, so a mistake is explained before the request.
    const parsed = createProductSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === "seo" || ["metaTitle", "metaDescription", "ogImage", "brand", "gtin", "mpn"].includes(String(issue?.path[0]))) {
        setSeoOpen(true);
      }
      return toast.error(issue?.message ?? "Please check the product details");
    }

    setSaving(true);
    try {
      const saved = product
        ? await AdminProductService.updateProduct(product.id, payload)
        : await AdminProductService.createProduct(payload);
      toast.success(product ? "Product updated" : "Product created");
      onSaved(saved);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not save product"));
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
        <View className="flex-1"><Input label="Price (₹)" keyboardType="decimal-pad" value={price} onChangeText={(t) => setPrice(onlyDecimal(t))} /></View>
        <View className="flex-1"><Input label="Quantity" keyboardType="number-pad" value={quantity} onChangeText={(t) => { const q = onlyInt(t); setQuantity(q); setInStock((Number(q) || 0) > 0); }} /></View>
      </View>

      {/* Sale pricing */}
      <View className="gap-3 rounded-lg border border-border bg-surface p-3">
        <ToggleRow title="On sale" subtitle="Show a discounted price to customers." value={isOnSale} onChange={setIsOnSale} />
        {isOnSale ? (
          <>
            <Input label="Sale Price (₹) — must be below the regular price" keyboardType="decimal-pad" value={salePrice} onChangeText={(t) => setSalePrice(onlyDecimal(t))} />
            <SelectSheet label="Price display" value={priceDisplay} options={PRICE_DISPLAY_OPTIONS} onChange={(v) => setPriceDisplay(v as PriceDisplayMode)} />
          </>
        ) : null}
      </View>

      <Input label="Cost Price (₹) — for exact P&L" keyboardType="decimal-pad" value={costPrice} onChangeText={(t) => setCostPrice(onlyDecimal(t))} />
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

      {/* Pre-order */}
      <View className="gap-3 rounded-lg border border-border bg-surface p-3">
        <ToggleRow title="Allow pre-orders when out of stock" value={preOrderEnabled} onChange={setPreOrderEnabled} />
        {preOrderEnabled ? (
          <>
            <View className="flex-row gap-2">
              <View className="flex-1"><Input label="Booking amount (₹)" keyboardType="decimal-pad" placeholder="0.00" value={bookingAmount} onChangeText={(t) => setBookingAmount(onlyDecimal(t))} /></View>
              <View className="flex-1"><Input label="Limit (optional)" keyboardType="number-pad" placeholder="Unlimited" value={preOrderLimit} onChangeText={(t) => setPreOrderLimit(onlyInt(t))} /></View>
            </View>
            <Input label="Availability note (optional)" placeholder="e.g. Ships by 15 Aug" value={preOrderNote} onChangeText={setPreOrderNote} maxLength={200} />
            <Text className="text-xs text-faint">
              Customers pay the booking amount now; the balance is collected via a secure link when stock is raised above 0.
            </Text>
          </>
        ) : null}
      </View>

      {/* Partial payment */}
      <View className="gap-3 rounded-lg border border-border bg-surface p-3">
        <ToggleRow title="Allow partial payment" subtitle="Deposit now, balance on delivery." value={partialPaymentEnabled} onChange={setPartialPaymentEnabled} />
        {partialPaymentEnabled ? (
          <>
            <Input label="Deposit % (optional)" keyboardType="number-pad" placeholder="Store default" value={depositPercent} onChangeText={(t) => setDepositPercent(onlyInt(t).slice(0, 2))} />
            <Text className="text-xs text-faint">
              The courier collects the balance at delivery. Leave the percentage blank to use the store-wide default. The
              deposit is non-refundable if the customer refuses delivery or cancels, and the option only appears where the
              courier can collect and the order is within the configured limits.
            </Text>
          </>
        ) : null}
      </View>

      {/* Cash on Delivery */}
      <View className="gap-2 rounded-lg border border-border bg-surface p-3">
        <ToggleRow title="Allow Cash on Delivery" value={codEnabled} onChange={setCodEnabled} />
        {codEnabled ? (
          <Text className="text-xs text-faint">
            Customers can pay in cash when the order arrives. The option only appears where the courier can collect, the
            order is within the COD order-value limit, and the customer has no previously refused COD delivery.
          </Text>
        ) : null}
      </View>

      {/* SEO + Google Shopping — collapsed by default; most edits never touch it. */}
      <View className="gap-3 rounded-lg border border-border bg-surface p-3">
        <Pressable onPress={() => setSeoOpen((o) => !o)} className="flex-row items-center justify-between" accessibilityRole="button">
          <View className="flex-1">
            <Text className="font-jakarta-semibold text-text">Search engine & Google Shopping</Text>
            <Text className="text-xs text-faint">Leave blank to use the auto-generated values.</Text>
          </View>
          <Ionicons name={seoOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
        </Pressable>
        {seoOpen ? (
          <>
            <View className="gap-0.5 rounded-lg border border-border bg-surface-2 p-3">
              <Text className="text-[11px] text-faint">Google preview</Text>
              <Text numberOfLines={1} className="text-xs text-success">littlestepz.in › products/{slug || "product-slug"}</Text>
              <Text numberOfLines={1} className="text-base text-info">{metaTitle || name || "Product name"}</Text>
              <Text numberOfLines={2} className="text-xs text-muted">{metaDescription || description || "—"}</Text>
            </View>
            <View>
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-sm font-jakarta-medium text-text">Meta title</Text>
                <Counter n={metaTitle.length} max={TITLE_MAX} />
              </View>
              <Input value={metaTitle} onChangeText={setMetaTitle} placeholder={name || "Product name"} maxLength={70} />
            </View>
            <View>
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-sm font-jakarta-medium text-text">Meta description</Text>
                <Counter n={metaDescription.length} max={DESC_MAX} />
              </View>
              <Input value={metaDescription} onChangeText={setMetaDescription} placeholder="Shown under the title in search results" multiline maxLength={DESC_MAX} />
            </View>
            <Input label="Social share image URL (optional)" value={ogImage} onChangeText={setOgImage} autoCapitalize="none" keyboardType="url" placeholder="Defaults to the first image" />
            <ToggleRow title="Show in Google & sitemap" subtitle="Off adds noindex and removes the page from the sitemap." value={!noindex} onChange={(on) => setNoindex(!on)} />
            <View className="h-px bg-border" />
            <Text className="text-sm font-jakarta-semibold text-text">Product identity</Text>
            <View className="flex-row gap-2">
              <View className="flex-1"><Input label="Brand" value={brand} onChangeText={setBrand} maxLength={100} /></View>
              <View className="flex-1"><SelectSheet label="Condition" value={condition} options={CONDITION_OPTIONS} onChange={setCondition} /></View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1"><Input label="GTIN (barcode)" value={gtin} onChangeText={setGtin} keyboardType="number-pad" maxLength={50} /></View>
              <View className="flex-1"><Input label="MPN" value={mpn} onChangeText={setMpn} autoCapitalize="characters" maxLength={70} /></View>
            </View>
          </>
        ) : null}
      </View>

      <Button label={product ? "Save Product Details" : "Create Product"} loading={saving} onPress={save} />
      {product ? (
        <Text className="text-xs text-muted">
          Saves product details only. Variants and images are saved in their own sections below.
        </Text>
      ) : null}
    </View>
  );
}
