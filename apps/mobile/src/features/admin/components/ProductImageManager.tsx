import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Sheet } from "../../../components/ui/Sheet";
import { AdminProductService, type AdminProductImage } from "../services/admin.services";
import { pickImage, uploadToCloudinary } from "../../../lib/upload/uploadToCloudinary";
import { toast } from "../../../store/toast.store";
import { colors } from "../../../theme/tokens";
import { getErrorMessage } from "../../../lib/utils/errors";

export function ProductImageManager({
  productId,
  images,
  onChange,
  variantId,
}: {
  productId: string;
  images: AdminProductImage[];
  onChange: () => void;
  /** When set, images are managed for this variant instead of the product. */
  variantId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  /** The image open in the edit sheet (alt text / replace / delete). */
  const [selected, setSelected] = useState<AdminProductImage | null>(null);
  const [alt, setAlt] = useState("");
  const [savingAlt, setSavingAlt] = useState(false);
  const [replacing, setReplacing] = useState(false);

  const getSignature = () =>
    variantId
      ? AdminProductService.getVariantImageSignature(variantId)
      : AdminProductService.getImageSignature(productId);

  const add = async () => {
    const asset = await pickImage();
    if (!asset) return;
    setUploading(true);
    try {
      const uploaded = await uploadToCloudinary(asset, await getSignature());
      // `publicId` is required by the API — it is how the image is later replaced or
      // deleted on Cloudinary. Omitting it made every upload fail at this step.
      const payload = { url: uploaded.secure_url, publicId: uploaded.public_id, sortOrder: images.length };
      if (variantId) {
        await AdminProductService.addVariantImage(variantId, payload);
      } else {
        await AdminProductService.addImage(productId, payload);
      }
      toast.success("Image added");
      onChange();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const openImage = (img: AdminProductImage) => {
    setSelected(img);
    setAlt(img.alt ?? "");
  };

  const saveAlt = async () => {
    if (!selected) return;
    const next = alt.trim();
    if ((selected.alt ?? "") === next) {
      setSelected(null);
      return;
    }
    setSavingAlt(true);
    try {
      await AdminProductService.updateImageAlt(selected.id, next);
      toast.success("Alt text saved");
      setSelected(null);
      onChange();
    } catch (e) {
      toast.error(getErrorMessage(e, "Couldn't save the alt text"));
    } finally {
      setSavingAlt(false);
    }
  };

  const replace = async () => {
    if (!selected) return;
    const asset = await pickImage();
    if (!asset) return;
    setReplacing(true);
    try {
      const uploaded = await uploadToCloudinary(asset, await getSignature());
      await AdminProductService.replaceImage(selected.id, { url: uploaded.secure_url, publicId: uploaded.public_id });
      toast.success("Image replaced");
      setSelected(null);
      onChange();
    } catch (e) {
      toast.error(getErrorMessage(e, "Replace failed"));
    } finally {
      setReplacing(false);
    }
  };

  const remove = (imageId: string) => {
    Alert.alert("Delete image", "Remove this image?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await AdminProductService.deleteImage(imageId);
            setSelected(null);
            onChange();
          } catch (e) {
            toast.error(getErrorMessage(e, "Could not delete image"));
          }
        },
      },
    ]);
  };

  const move = async (img: AdminProductImage, dir: -1 | 1) => {
    try {
      await AdminProductService.reorderImage(img.id, Math.max(0, (img.sortOrder ?? 0) + dir));
      onChange();
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not reorder"));
    }
  };

  const missingAlt = images.filter((i) => !(i.alt ?? "").trim()).length;
  const busy = savingAlt || replacing;

  return (
    <View className="gap-2">
      <Text className="font-jakarta-semibold text-text">Images</Text>
      <View className="flex-row flex-wrap gap-2">
        {images.map((img) => (
          <View key={img.id} className="overflow-hidden rounded-md border border-border">
            <Pressable onPress={() => openImage(img)} accessibilityRole="button" accessibilityLabel={img.alt ? `Edit image: ${img.alt}` : "Edit image"}>
              <Image source={{ uri: img.url }} style={{ width: 80, height: 80 }} contentFit="cover" />
              {!(img.alt ?? "").trim() ? (
                <View className="absolute right-1 top-1 rounded-full bg-warning px-1.5">
                  <Text className="text-[9px] font-jakarta-bold text-white">ALT</Text>
                </View>
              ) : null}
            </Pressable>
            <View className="flex-row items-center justify-between bg-surface px-1 py-0.5">
              <Pressable onPress={() => move(img, -1)} hitSlop={4} accessibilityLabel="Move left"><Ionicons name="arrow-back" size={14} color={colors.muted} /></Pressable>
              <Pressable onPress={() => remove(img.id)} hitSlop={4} accessibilityLabel="Delete image"><Ionicons name="trash-outline" size={14} color={colors.danger} /></Pressable>
              <Pressable onPress={() => move(img, 1)} hitSlop={4} accessibilityLabel="Move right"><Ionicons name="arrow-forward" size={14} color={colors.muted} /></Pressable>
            </View>
          </View>
        ))}
      </View>
      {missingAlt > 0 ? (
        <Text className="text-xs text-warning">
          {missingAlt} image{missingAlt === 1 ? "" : "s"} missing alt text — tap an image to add it for SEO and accessibility.
        </Text>
      ) : null}
      <Button label="Add Image" variant="outline" loading={uploading} onPress={add} left={<Ionicons name="image-outline" size={16} color={colors.primary} />} />

      <Sheet visible={selected !== null} onClose={() => (busy ? null : setSelected(null))} title="Edit image">
        {selected ? (
          <View className="gap-3">
            <Image source={{ uri: selected.url }} style={{ width: "100%", height: 180, borderRadius: 12 }} contentFit="contain" />
            <Input
              label="Alt text"
              value={alt}
              onChangeText={setAlt}
              placeholder="Describe the image, e.g. Red RC car, side view"
              maxLength={200}
            />
            <Button label="Save Alt Text" loading={savingAlt} disabled={replacing} onPress={saveAlt} />
            <Button
              label="Replace Image"
              variant="outline"
              loading={replacing}
              disabled={savingAlt}
              onPress={replace}
              left={<Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />}
            />
            <Button label="Delete Image" variant="danger" disabled={busy} onPress={() => remove(selected.id)} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
