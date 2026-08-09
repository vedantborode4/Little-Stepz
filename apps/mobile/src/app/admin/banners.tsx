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
import { DateField } from "../../components/ui/DateField";
import { Sheet } from "../../components/ui/Sheet";
import { SelectSheet } from "../../components/ui/SelectSheet";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  AdminBannerService,
  AdminProductService,
  type AdminBanner,
  type CreateBannerBody,
} from "../../features/admin/services/admin.services";
import { pickImage, uploadToCloudinary } from "../../lib/upload/uploadToCloudinary";
import { BANNER_POSITIONS } from "../../lib/enums";
import { qk } from "../../lib/api/query-client";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

export default function AdminBanners() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: qk.adminBanners, queryFn: () => AdminBannerService.getAll({ limit: 100 }) });
  const banners = data?.banners ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBanner | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [position, setPosition] = useState<string>("HOME_HERO");
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const openForm = (b?: AdminBanner) => {
    setEditing(b ?? null);
    setTitle(b?.title ?? "");
    setSubtitle(b?.subtitle ?? "");
    setImageUrl(b?.imageUrl ?? "");
    setLinkUrl(b?.linkUrl ?? "");
    setAltText(b?.altText ?? "");
    setSortOrder(b?.sortOrder != null ? String(b.sortOrder) : "");
    setStartsAt(b?.startsAt ?? null);
    setEndsAt(b?.endsAt ?? null);
    setPosition(b?.position ?? "HOME_HERO");
    setIsActive(b?.isActive ?? true);
    setOpen(true);
  };

  const upload = async () => {
    const asset = await pickImage();
    if (!asset) return;
    setUploading(true);
    try {
      const sig = await AdminProductService.getImageSignature("banners");
      const res = await uploadToCloudinary(asset, { ...sig, folder: sig.folder ?? "banners" });
      setImageUrl(res.secure_url);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!imageUrl) return toast.error("Image required");
    if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
      return toast.error("'Ends At' can't be before 'Starts At'");
    }
    const body: CreateBannerBody = {
      title: title || undefined, subtitle: subtitle || undefined, imageUrl, linkUrl: linkUrl || undefined,
      altText: altText || undefined, sortOrder: sortOrder ? Number(sortOrder) : undefined,
      startsAt: startsAt ?? undefined, endsAt: endsAt ?? undefined,
      position: position as any, isActive,
    };
    setSaving(true);
    try {
      if (editing) await AdminBannerService.update(editing.id, body);
      else await AdminBannerService.create(body);
      toast.success(editing ? "Banner updated" : "Banner created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: qk.adminBanners });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save banner");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (b: AdminBanner) => {
    try {
      await AdminBannerService.toggle(b.id);
      qc.invalidateQueries({ queryKey: qk.adminBanners });
    } catch {
      toast.error("Could not toggle");
    }
  };

  const remove = (b: AdminBanner) => {
    Alert.alert("Delete banner", `Delete "${b.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await AdminBannerService.delete(b.id);
            qc.invalidateQueries({ queryKey: qk.adminBanners });
          } catch {
            toast.error("Could not delete banner");
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell
        active="banners"
        title="Banners"
        right={<Pressable onPress={() => openForm()} hitSlop={8}><Ionicons name="add-circle" size={26} color={colors.primary} /></Pressable>}
      >
        <FlatList
          data={banners}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          ListEmptyComponent={isLoading ? null : <EmptyState icon="image-outline" title="No banners" />}
          renderItem={({ item }) => (
            <Card className="gap-2 p-0 overflow-hidden">
              <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 120 }} contentFit="cover" />
              <View className="gap-1 p-3">
                <Text className="font-jakarta-semibold text-text">{item.title}</Text>
                <Text className="text-xs text-muted">{item.position}</Text>
                <View className="mt-1 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm text-text">Active</Text>
                    <Switch value={item.isActive} onValueChange={() => toggle(item)} trackColor={{ true: colors.primary }} />
                  </View>
                  <View className="flex-row gap-4">
                    <Ionicons name="create-outline" size={20} color={colors.text} onPress={() => openForm(item)} />
                    <Ionicons name="trash-outline" size={20} color={colors.danger} onPress={() => remove(item)} />
                  </View>
                </View>
              </View>
            </Card>
          )}
        />
      </AdminShell>

      <Sheet visible={open} onClose={() => setOpen(false)} title={editing ? "Edit Banner" : "New Banner"}>
        <View className="gap-3">
          {imageUrl ? <Image source={{ uri: imageUrl }} style={{ width: "100%", height: 120, borderRadius: 12 }} contentFit="cover" /> : null}
          <Button label={imageUrl ? "Change Image" : "Upload Image"} variant="outline" loading={uploading} onPress={upload} left={<Ionicons name="image-outline" size={16} color={colors.primary} />} />
          <Input label="Title" value={title} onChangeText={setTitle} />
          <Input label="Subtitle" value={subtitle} onChangeText={setSubtitle} />
          <Input label="Link URL" value={linkUrl} onChangeText={setLinkUrl} autoCapitalize="none" />
          <Input label="Alt Text" value={altText} onChangeText={setAltText} placeholder="Image description (accessibility)" />
          <SelectSheet label="Position" value={position} options={BANNER_POSITIONS.map((p) => ({ label: p, value: p }))} onChange={setPosition} />
          <Input label="Sort Order" keyboardType="numeric" value={sortOrder} onChangeText={setSortOrder} placeholder="0" />
          <View className="flex-row gap-2">
            <View className="flex-1"><DateField label="Starts At" value={startsAt} onChange={setStartsAt} placeholder="Immediately" /></View>
            <View className="flex-1"><DateField label="Ends At" value={endsAt} onChange={setEndsAt} placeholder="No end" /></View>
          </View>
          <Pressable className="flex-row items-center justify-between" onPress={() => setIsActive((v) => !v)}>
            <Text className="text-text">Active</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.primary }} />
          </Pressable>
          <Button label="Save Banner" loading={saving} onPress={save} />
        </View>
      </Sheet>
    </ScreenContainer>
  );
}
