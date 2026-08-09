import * as ImagePicker from "expo-image-picker";

export interface CloudinarySignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}

export interface CloudinaryResult {
  secure_url: string;
  public_id: string;
}

/** Pick an image from the library. Returns the asset or null if cancelled/denied. */
export async function pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

/**
 * Upload a picked asset to Cloudinary using a signed upload.
 * RN differs from web only in the `file` field shape ({ uri, name, type }).
 * Uses raw fetch (NOT the api client) so no Bearer/baseURL is attached.
 */
export async function uploadToCloudinary(
  asset: ImagePicker.ImagePickerAsset,
  sig: CloudinarySignature
): Promise<CloudinaryResult> {
  const form = new FormData();
  form.append("file", {
    uri: asset.uri,
    name: asset.fileName ?? "upload.jpg",
    type: asset.mimeType ?? "image/jpeg",
  } as any);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!json.secure_url) throw new Error(json?.error?.message || "Upload failed");
  return { secure_url: json.secure_url, public_id: json.public_id };
}
