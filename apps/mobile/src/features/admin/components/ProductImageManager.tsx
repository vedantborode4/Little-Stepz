import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../../components/ui/Button";
import { AdminProductService, type AdminProductImage } from "../services/admin.services";
import { pickImage, uploadToCloudinary } from "../../../lib/upload/uploadToCloudinary";
import { toast } from "../../../store/toast.store";
import { colors } from "../../../theme/tokens";

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

  const add = async () => {
    const asset = await pickImage();
    if (!asset) return;
    setUploading(true);
    try {
      const sig = variantId
        ? await AdminProductService.getVariantImageSignature(variantId)
        : await AdminProductService.getImageSignature(productId);
      const uploaded = await uploadToCloudinary(asset, sig);
      if (variantId) {
        await AdminProductService.addVariantImage(variantId, { url: uploaded.secure_url, sortOrder: images.length });
      } else {
        await AdminProductService.addImage(productId, { url: uploaded.secure_url, sortOrder: images.length });
      }
      toast.success("Image added");
      onChange();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
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
            onChange();
          } catch {
            toast.error("Could not delete image");
          }
        },
      },
    ]);
  };

  const move = async (img: AdminProductImage, dir: -1 | 1) => {
    try {
      await AdminProductService.reorderImage(img.id, Math.max(0, (img.sortOrder ?? 0) + dir));
      onChange();
    } catch {
      toast.error("Could not reorder");
    }
  };

  return (
    <View className="gap-2">
      <Text className="font-jakarta-semibold text-text">Images</Text>
      <View className="flex-row flex-wrap gap-2">
        {images.map((img) => (
          <View key={img.id} className="overflow-hidden rounded-md border border-border">
            <Image source={{ uri: img.url }} style={{ width: 80, height: 80 }} contentFit="cover" />
            <View className="flex-row items-center justify-between bg-surface px-1 py-0.5">
              <Pressable onPress={() => move(img, -1)} hitSlop={4}><Ionicons name="arrow-back" size={14} color={colors.muted} /></Pressable>
              <Pressable onPress={() => remove(img.id)} hitSlop={4}><Ionicons name="trash-outline" size={14} color={colors.danger} /></Pressable>
              <Pressable onPress={() => move(img, 1)} hitSlop={4}><Ionicons name="arrow-forward" size={14} color={colors.muted} /></Pressable>
            </View>
          </View>
        ))}
      </View>
      <Button label="Add Image" variant="outline" loading={uploading} onPress={add} left={<Ionicons name="image-outline" size={16} color={colors.primary} />} />
    </View>
  );
}
