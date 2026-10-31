import { createHash } from "crypto";
import { env } from "../config/env";
import { ApiError } from "./http";
import { logger } from "./logger";

/**
 * Signed calls to Cloudinary's upload API, without the SDK. The account may be
 * the website's own, so the CRM only ever uploads into, and deletes from,
 * CLOUDINARY_FOLDER.
 */

const IMAGE_TYPES: { mime: string; matches: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", matches: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
];

/** Judged by the file's first bytes, not its name or the declared type. */
export function imageMimeOf(file: Buffer): string | null {
  return IMAGE_TYPES.find((t) => t.matches(file))?.mime ?? null;
}

export const imageUploadsEnabled = () => Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

function signed(params: Record<string, string>) {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = createHash("sha1")
    .update(payload + env.CLOUDINARY_API_SECRET)
    .digest("hex");
  return { ...params, api_key: env.CLOUDINARY_API_KEY!, signature };
}

const endpoint = (action: "upload" | "destroy") => `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/${action}`;
const timestamp = () => String(Math.floor(Date.now() / 1000));

export async function uploadImage(file: Buffer, mime: string, subfolder: string): Promise<{ url: string; publicId: string }> {
  if (!imageUploadsEnabled()) {
    throw new ApiError(503, "IMAGE_UPLOADS_OFF", "Photo uploads aren't set up on this server. Add the photo by link instead.");
  }
  const params = signed({
    folder: `${env.CLOUDINARY_FOLDER}/${subfolder}`,
    timestamp: timestamp(),
    // Stored no larger than 2000px on the long side; plenty for a product photo.
    transformation: "c_limit,w_2000,h_2000",
  });
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(file)], { type: mime }));
  for (const [k, v] of Object.entries(params)) form.append(k, v);

  const res = await fetch(endpoint("upload"), { method: "POST", body: form, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { secure_url?: string; public_id?: string; error?: { message?: string } } | null;
  if (!res?.ok || !body?.secure_url || !body.public_id) {
    logger.warn({ status: res?.status, error: body?.error?.message }, "cloudinary upload failed");
    throw new ApiError(502, "IMAGE_UPLOAD_FAILED", "The photo couldn't be uploaded. Try again.");
  }
  return { url: body.secure_url, publicId: body.public_id };
}

/** Best effort, after the database change has committed: a leftover file costs storage, never correctness. */
export async function deleteUploadedImage(publicId: string): Promise<void> {
  if (!imageUploadsEnabled() || !publicId.startsWith(`${env.CLOUDINARY_FOLDER}/`)) return;
  try {
    const res = await fetch(endpoint("destroy"), {
      method: "POST",
      body: new URLSearchParams(signed({ public_id: publicId, timestamp: timestamp() })),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) logger.warn({ publicId, status: res.status }, "cloudinary delete failed");
  } catch (err) {
    logger.warn({ publicId, err }, "cloudinary delete failed");
  }
}
