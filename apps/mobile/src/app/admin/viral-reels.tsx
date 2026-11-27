import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { viralReelSchema, VIRAL_REEL_MAX_PRODUCTS } from "@repo/zod-schema/index";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AdminShell } from "../../features/admin/components/AdminShell";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  AdminProductService,
  AdminViralReelService,
  type AdminReelProduct,
  type AdminViralReel,
} from "../../features/admin/services/admin.services";
import { ProductService } from "../../lib/services/product.service";
import { pickImage, uploadToCloudinary } from "../../lib/upload/uploadToCloudinary";
import { useDebounce } from "../../hooks/useDebounce";
import { qk } from "../../lib/api/query-client";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";
import { getErrorMessage } from "../../lib/utils/errors";

const hasLiveProduct = (r: AdminViralReel) => r.products.some((p) => p.visible !== false);

function ProductPicker({
  selected,
  onChange,
  error,
}: {
  selected: AdminReelProduct[];
  onChange: (next: AdminReelProduct[]) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const q = useDebounce(query.trim(), 300);
  const full = selected.length >= VIRAL_REEL_MAX_PRODUCTS;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["admin", "viral-reels", "product-search", q],
    queryFn: async () => {
      const res = await ProductService.getProducts({ search: q, limit: 8 });
      return res.data.map((p) => ({ id: p.id, name: p.name, slug: p.slug, imageUrl: p.images?.[0]?.url ?? null }));
    },
    enabled: q.length >= 2 && !full,
  });

  const add = (p: AdminReelProduct) => {
    if (full || selected.some((s) => s.id === p.id)) return;
    onChange([...selected, p]);
    setQuery("");
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <View className="gap-2">
      <Text className="text-sm font-jakarta-medium text-text">
        Products ({selected.length}/{VIRAL_REEL_MAX_PRODUCTS})
      </Text>

      {selected.length > 0 && (
        <View className="overflow-hidden rounded-lg border border-border">
          {selected.map((p, i) => (
            <View key={p.id} className={`flex-row items-center gap-3 px-3 py-2 ${i > 0 ? "border-t border-border" : ""}`}>
              <Image source={{ uri: p.imageUrl ?? undefined }} style={{ width: 36, height: 36, borderRadius: 8 }} contentFit="cover" />
              <View className="flex-1">
                <Text className="text-sm text-text" numberOfLines={1}>{p.name}</Text>
                {p.visible === false && <Text className="text-xs text-danger">Hidden on the store</Text>}
              </View>
              <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6} className={i === 0 ? "opacity-30" : ""}>
                <Ionicons name="arrow-up" size={18} color={colors.muted} />
              </Pressable>
              <Pressable onPress={() => move(i, 1)} disabled={i === selected.length - 1} hitSlop={6} className={i === selected.length - 1 ? "opacity-30" : ""}>
                <Ionicons name="arrow-down" size={18} color={colors.muted} />
              </Pressable>
              <Pressable onPress={() => onChange(selected.filter((s) => s.id !== p.id))} hitSlop={6}>
                <Ionicons name="close" size={20} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {full ? (
        <Text className="text-xs text-muted">Up to {VIRAL_REEL_MAX_PRODUCTS} products per reel.</Text>
      ) : (
        <>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search products to link"
            autoCapitalize="none"
            autoCorrect={false}
            error={error}
          />
          {q.length >= 2 && (
            <View className="overflow-hidden rounded-lg border border-border">
              {isFetching && results.length === 0 ? (
                <ActivityIndicator className="py-3" color={colors.primary} />
              ) : results.length === 0 ? (
                <Text className="px-3 py-3 text-sm text-muted">No products found</Text>
              ) : (
                results.map((p, i) => {
                  const added = selected.some((s) => s.id === p.id);
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => add(p)}
                      disabled={added}
                      className={`flex-row items-center gap-3 px-3 py-2 ${i > 0 ? "border-t border-border" : ""} ${added ? "opacity-50" : ""}`}
                    >
                      <Image source={{ uri: p.imageUrl ?? undefined }} style={{ width: 36, height: 36, borderRadius: 8 }} contentFit="cover" />
                      <Text className="flex-1 text-sm text-text" numberOfLines={1}>{p.name}</Text>
                      <Ionicons name={added ? "checkmark" : "add"} size={20} color={colors.primary} />
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

function ReelForm({
  reel,
  onClose,
  onSaved,
}: {
  reel: AdminViralReel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [reelUrl, setReelUrl] = useState(reel?.reelUrl ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(reel?.coverImageUrl ?? "");
  const [caption, setCaption] = useState(reel?.caption ?? "");
  const [products, setProducts] = useState<AdminReelProduct[]>(reel?.products ?? []);
  const [sortOrder, setSortOrder] = useState(String(reel?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(reel?.isActive ?? true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (key: string) => setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));

  const uploadCover = async () => {
    const asset = await pickImage();
    if (!asset) return;
    setUploading(true);
    try {
      const sig = await AdminProductService.getImageSignature("viral-reels");
      const res = await uploadToCloudinary(asset, sig);
      setCoverImageUrl(res.secure_url);
      clearError("coverImageUrl");
    } catch (e: any) {
      toast.error(e?.message || "Cover upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const parsed = viralReelSchema.safeParse({
      reelUrl,
      coverImageUrl,
      caption: caption.trim() || undefined,
      productIds: products.map((p) => p.id),
      sortOrder: sortOrder.trim() === "" ? 0 : Number(sortOrder),
      isActive,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? "form")] ??= issue.message;
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      if (reel) await AdminViralReelService.update(reel.id, parsed.data);
      else await AdminViralReelService.create(parsed.data);
      toast.success(reel ? "Reel updated" : "Reel added");
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not save reel"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Text className="text-lg font-jakarta-bold text-text">{reel ? "Edit Reel" : "New Reel"}</Text>
        <Pressable onPress={onClose} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="Instagram reel link"
            value={reelUrl}
            onChangeText={(v) => { setReelUrl(v); clearError("reelUrl"); }}
            placeholder="https://www.instagram.com/reel/…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={errors.reelUrl}
          />

          <View className="gap-2">
            <Text className="text-sm font-jakarta-medium text-text">Cover image</Text>
            <View className="flex-row items-end gap-3">
              <View
                className={`overflow-hidden rounded-lg border bg-surface-2 ${errors.coverImageUrl ? "border-danger" : "border-border"}`}
                style={{ width: 108, aspectRatio: 9 / 16 }}
              >
                {coverImageUrl ? (
                  <Image source={{ uri: coverImageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="image-outline" size={28} color={colors.faint} />
                  </View>
                )}
              </View>
              <View className="flex-1 gap-1">
                <Button
                  label={coverImageUrl ? "Change cover" : "Upload cover"}
                  variant="outline"
                  loading={uploading}
                  onPress={uploadCover}
                  left={<Ionicons name="image-outline" size={16} color={colors.primary} />}
                />
                <Text className="text-xs text-muted">Portrait (9:16), e.g. a frame from the reel.</Text>
              </View>
            </View>
            {errors.coverImageUrl ? <Text className="text-xs text-danger">Upload a cover image</Text> : null}
          </View>

          <Input
            label="Caption (optional)"
            value={caption}
            onChangeText={setCaption}
            maxLength={80}
            placeholder="Shown over the cover"
          />

          <ProductPicker
            selected={products}
            onChange={(next) => { setProducts(next); clearError("productIds"); }}
            error={errors.productIds}
          />

          <Input
            label="Sort order"
            value={sortOrder}
            onChangeText={(v) => { setSortOrder(v.replace(/[^0-9]/g, "")); clearError("sortOrder"); }}
            keyboardType="number-pad"
            placeholder="0"
            error={errors.sortOrder}
          />

          <Pressable className="flex-row items-center justify-between" onPress={() => setIsActive((v) => !v)}>
            <Text className="text-text">Show on home page</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.primary }} />
          </Pressable>

          <Button label={reel ? "Save Reel" : "Add Reel"} loading={saving} disabled={uploading} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function AdminViralReels() {
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const cardW = (width - 32 - 12) / 2;
  const { data: reels = [], isLoading } = useQuery({ queryKey: qk.adminViralReels, queryFn: AdminViralReelService.getAll });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminViralReel | null>(null);
  const [formKey, setFormKey] = useState(0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.adminViralReels });
    qc.invalidateQueries({ queryKey: qk.viralReels });
  };

  const openForm = (r?: AdminViralReel) => {
    setEditing(r ?? null);
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  const toggle = async (r: AdminViralReel) => {
    try {
      await AdminViralReelService.toggle(r.id);
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not update reel"));
    }
  };

  const remove = (r: AdminViralReel) => {
    Alert.alert("Delete reel", "Remove this reel from the home page for good?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await AdminViralReelService.delete(r.id);
            toast.success("Reel deleted");
            refresh();
          } catch (e) {
            toast.error(getErrorMessage(e, "Could not delete reel"));
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell
        active="viral-reels"
        title="Viral Reels"
        right={<Pressable onPress={() => openForm()} hitSlop={8}><Ionicons name="add-circle" size={26} color={colors.primary} /></Pressable>}
      >
        <FlatList
          data={reels}
          keyExtractor={(r) => r.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          ListHeaderComponent={
            reels.length > 0 ? (
              <Text className="text-xs text-muted">Shown under Best Sellers on the home page, lowest sort order first.</Text>
            ) : null
          }
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator className="mt-16" color={colors.primary} />
            ) : (
              <EmptyState
                icon="film-outline"
                title="No reels yet"
                subtitle="Add an Instagram reel and link the products it features."
                actionLabel="Add reel"
                onAction={() => openForm()}
              />
            )
          }
          renderItem={({ item }) => {
            const live = hasLiveProduct(item);
            return (
              <Card clip className="p-0" style={{ width: cardW }}>
                <Pressable onPress={() => openForm(item)}>
                  <View style={{ width: "100%", aspectRatio: 9 / 16 }} className="bg-surface-2">
                    <Image source={{ uri: item.coverImageUrl }} style={{ width: "100%", height: "100%", opacity: item.isActive ? 1 : 0.5 }} contentFit="cover" />
                    <View className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-black/50">
                      <Ionicons name="play" size={14} color="#fff" />
                    </View>
                    {item.caption ? (
                      <View className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1.5">
                        <Text className="text-xs text-white" numberOfLines={2}>{item.caption}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
                <View className="gap-1.5 p-2.5">
                  <Text className="text-xs text-text" numberOfLines={1}>
                    {item.products[0]?.name ?? "No products"}
                    {item.products.length > 1 ? ` +${item.products.length - 1}` : ""}
                  </Text>
                  {!live && <Text className="text-[11px] text-danger">No live products — hidden on the store</Text>}
                  <Text className="text-[11px] text-muted">Sort {item.sortOrder}</Text>
                  <View className="flex-row items-center justify-between">
                    <Switch value={item.isActive} onValueChange={() => toggle(item)} trackColor={{ true: colors.primary }} />
                    <View className="flex-row gap-3">
                      <Ionicons name="logo-instagram" size={19} color={colors.text} onPress={() => Linking.openURL(item.reelUrl)} />
                      <Ionicons name="create-outline" size={19} color={colors.text} onPress={() => openForm(item)} />
                      <Ionicons name="trash-outline" size={19} color={colors.danger} onPress={() => remove(item)} />
                    </View>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      </AdminShell>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <ReelForm
          key={formKey}
          reel={editing}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); refresh(); }}
        />
      </Modal>
    </ScreenContainer>
  );
}
