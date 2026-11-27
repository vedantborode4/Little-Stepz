import { z } from "zod";
import { uuidSchema } from "./common";

export const VIRAL_REEL_MAX_PRODUCTS = 6;

// Matches reel/post links as shared from the app or the web, with or without a
// username segment, e.g. instagram.com/reel/ABC/?igsh=… or instagram.com/name/reel/ABC.
const INSTAGRAM_POST_URL =
  /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]+)/i;

/** Pulls the shortcode out of a shared link and returns the canonical URL without tracking params. */
export function normalizeInstagramReelUrl(raw: string): string | null {
  const match = raw.trim().match(INSTAGRAM_POST_URL);
  if (!match) return null;
  const kind = match[1]!.toLowerCase().startsWith("reel") ? "reel" : match[1]!.toLowerCase();
  return `https://www.instagram.com/${kind}/${match[2]}/`;
}

export const instagramReelUrlSchema = z
  .string()
  .max(500)
  .transform((value, ctx) => {
    const url = normalizeInstagramReelUrl(value);
    if (!url) {
      ctx.addIssue({ code: "custom", message: "Paste an Instagram reel link" });
      return z.NEVER;
    }
    return url;
  });

export const viralReelSchema = z
  .object({
    reelUrl:       instagramReelUrlSchema,
    coverImageUrl: z.string().url("Upload a cover image").max(2000),
    caption:       z.string().trim().max(80).optional(),
    productIds: z
      .array(uuidSchema)
      .min(1, "Link at least one product")
      .max(VIRAL_REEL_MAX_PRODUCTS, `Up to ${VIRAL_REEL_MAX_PRODUCTS} products per reel`)
      .refine((ids) => new Set(ids).size === ids.length, "A product is linked twice"),
    sortOrder: z.number().int().min(0).max(999).default(0),
    isActive:  z.boolean().default(true),
  })
  .strict();

export const viralReelParamSchema = z.object({ id: uuidSchema });

export type ViralReelInput = z.input<typeof viralReelSchema>;
export type ViralReelBody  = z.infer<typeof viralReelSchema>;
