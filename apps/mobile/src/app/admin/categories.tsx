import { useState } from "react";
import { Alert, FlatList, Pressable, Switch, Text, View } from "react-native";
import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AdminShell } from "../../features/admin/components/AdminShell";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { SelectSheet } from "../../components/ui/SelectSheet";
import { EmptyState } from "../../components/ui/EmptyState";
import { AdminCategoryService, AdminProductService, type AdminCategory } from "../../features/admin/services/admin.services";
import { pickImage, uploadToCloudinary } from "../../lib/upload/uploadToCloudinary";
import { qk } from "../../lib/api/query-client";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function AdminCategories() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: qk.adminCategories, queryFn: () => AdminCategoryService.getAll() });
  const categories = data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [parentId, setParentId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const openForm = (cat?: AdminCategory) => {
    setEditing(cat ?? null);
    setName(cat?.name ?? "");
    setSlug(cat?.slug ?? "");
    setDescription(cat?.description ?? "");
    setImage(cat?.image ?? "");
    setParentId(cat?.parentId ?? "");
    setIsActive(cat?.isActive ?? true);
    setOpen(true);
  };

  const upload = async () => {
    const asset = await pickImage();
    if (!asset) return;
    setUploading(true);
    try {
      const sig = await AdminProductService.getImageSignature("categories");
      const res = await uploadToCloudinary(asset, { ...sig, folder: sig.folder ?? "categories" });
      setImage(res.secure_url);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      const body = { name, slug: slug.trim() || slugify(name), description: description || undefined, image: image || undefined, parentId: parentId || undefined, isActive };
      if (editing) await AdminCategoryService.update(editing.id, { ...body, description: description || undefined, image: image || "", parentId: parentId || null });
      else await AdminCategoryService.create(body);
      toast.success(editing ? "Category updated" : "Category created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: qk.adminCategories });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save category");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (cat: AdminCategory, next: boolean) => {
    // Optimistic — patch the cached list, revert on failure.
    const patch = (active: boolean) =>
      qc.setQueryData<AdminCategory[]>(qk.adminCategories, (prev) =>
        (prev ?? []).map((c) => (c.id === cat.id ? { ...c, isActive: active } : c))
      );
    patch(next);
    try {
      await AdminCategoryService.update(cat.id, { isActive: next });
    } catch {
      patch(!next);
      toast.error("Could not update status");
    }
  };

  const remove = (cat: AdminCategory) => {
    Alert.alert("Delete category", `Delete "${cat.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await AdminCategoryService.delete(cat.id);
            qc.invalidateQueries({ queryKey: qk.adminCategories });
          } catch {
            toast.error("Could not delete category");
          }
        },
      },
    ]);
  };

  const parentOptions = [{ label: "None (top level)", value: "" }, ...categories.filter((c) => c.id !== editing?.id).map((c) => ({ label: c.name, value: c.id }))];

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell
        active="categories"
        title="Categories"
        right={<Pressable onPress={() => openForm()} hitSlop={8}><Ionicons name="add-circle" size={26} color={colors.primary} /></Pressable>}
      >
        <FlatList
          data={categories}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          ListEmptyComponent={isLoading ? null : <EmptyState icon="pricetags-outline" title="No categories" />}
          renderItem={({ item }) => (
            <Card className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center gap-3">
                {item.image ? (
                  <Image source={{ uri: item.image }} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="cover" />
                ) : (
                  <View className="h-10 w-10 items-center justify-center rounded-lg bg-bg">
                    <Ionicons name="pricetag-outline" size={18} color={colors.muted} />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="font-jakarta-medium text-text">{item.name}</Text>
                  <Text className="text-xs text-muted">{item.slug}{item.parentId ? " · sub-category" : ""}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-4">
                <Switch
                  value={item.isActive !== false}
                  onValueChange={(v) => toggleActive(item, v)}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor="#fff"
                />
                <Ionicons name="create-outline" size={20} color={colors.text} onPress={() => openForm(item)} />
                <Ionicons name="trash-outline" size={20} color={colors.danger} onPress={() => remove(item)} />
              </View>
            </Card>
          )}
        />
      </AdminShell>

      <Sheet visible={open} onClose={() => setOpen(false)} title={editing ? "Edit Category" : "New Category"}>
        <View className="gap-3">
          {image ? <Image source={{ uri: image }} style={{ width: "100%", height: 120, borderRadius: 12 }} contentFit="cover" /> : null}
          <Button label={image ? "Change Image" : "Upload Image"} variant="outline" loading={uploading} onPress={upload} left={<Ionicons name="image-outline" size={16} color={colors.primary} />} />
          <Input label="Name" value={name} onChangeText={(t) => { setName(t); if (!editing) setSlug(slugify(t)); }} />
          <Input label="Slug" value={slug} onChangeText={setSlug} autoCapitalize="none" />
          <Input label="Description" value={description} onChangeText={setDescription} multiline placeholder="Optional description" />
          <SelectSheet label="Parent" placeholder="None" value={parentId} options={parentOptions} onChange={setParentId} />
          <Pressable className="flex-row items-center justify-between" onPress={() => setIsActive((v) => !v)}>
            <Text className="text-text">Active</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.primary }} />
          </Pressable>
          <Button label="Save" loading={saving} onPress={save} />
        </View>
      </Sheet>
    </ScreenContainer>
  );
}
