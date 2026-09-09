import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { api } from "./api/client";

/**
 * Fetch a PDF, write it to the cache and hand it to the share sheet.
 *
 * Expo Go cannot write to Downloads, so sharing is the only way to get a file off the
 * app. Shared by every invoice and receipt download rather than duplicated.
 */
export async function savePdfAndShare(path: string, fallbackName: string): Promise<string> {
  const res = await api.get(path, { responseType: "blob" });

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(res.data as Blob);
  });

  const disposition = res.headers?.["content-disposition"] as string | undefined;
  const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackName;

  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: "base64" });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
  }
  return file.uri;
}

/**
 * User-facing copy for a failed PDF request.
 *
 * `responseType: "blob"` applies to the error response too, so `err.response.data` is a
 * Blob and reading `.message` off it is always undefined. React Native's Blob has no
 * `.text()`, so the body goes through a FileReader the same way the PDF itself does.
 *
 * An unmapped server code would be gibberish on screen, so only a message that does not
 * look like one is shown; everything else falls back to the caller's copy.
 */
export async function pdfErrorMessage(err: unknown, fallback: string): Promise<string> {
  const body = (err as { response?: { data?: unknown } })?.response?.data;

  let payload: unknown = body;
  if (body instanceof Blob) {
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("unreadable"));
        reader.readAsText(body);
      });
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
  }

  const message = (payload as { message?: string } | undefined)?.message;
  if (!message || /^[A-Z][A-Z0-9_]{3,}$/.test(message)) return fallback;
  return message;
}
