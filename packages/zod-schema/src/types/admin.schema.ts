import { z } from "zod";
import { uuidSchema, paginationSchema } from "./common";


export const adminCommissionsQuerySchema = paginationSchema.extend({
  status:      z.enum(["PENDING", "APPROVED", "PAID", "CANCELLED"]).optional(),
  affiliateId: uuidSchema.optional(),
  from:        z.string().datetime().optional(),
  to:          z.string().datetime().optional(),
});

export const adminApproveCommissionSchema = z
  .object({
    note: z.string().max(500).optional(),
  })
  .strict();

export const adminPayCommissionSchema = z
  .object({
    transactionRef: z.string().max(100).optional(),
    note:           z.string().max(500).optional(),
  })
  .strict();


export const adminAffiliateDetailParamSchema = z.object({
  id: uuidSchema,
});

export const adminStatsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
});


const bannerPositions = [
  "HOME_HERO",
  "HOME_MID",
  "CATEGORY_TOP",
  "PRODUCT_SIDEBAR",
  "CHECKOUT_TOP",
] as const;

export const createBannerSchema = z
  .object({
    title:      z.string().min(1).max(200),
    subtitle:   z.string().max(500).optional(),
    imageUrl:   z.string().url("Must be a valid URL").max(2000),
    linkUrl:    z.string().url("Must be a valid URL").max(2000).optional(),
    altText:    z.string().max(300).optional(),
    position:   z.enum(bannerPositions),
    sortOrder:  z.number().int().min(0).max(999).default(0),
    isActive:   z.boolean().default(true),
    startsAt:   z.string().datetime().optional(),
    endsAt:     z.string().datetime().optional(),
    targetRole: z.enum(["USER", "AFFILIATE", "ADMIN"]).optional(),
  })
  .strict()
  .refine(
    (d) => {
      if (d.startsAt && d.endsAt) {
        return new Date(d.startsAt) < new Date(d.endsAt);
      }
      return true;
    },
    { message: "startsAt must be before endsAt", path: ["startsAt"] }
  );

export const updateBannerSchema = z
  .object({
    title:      z.string().min(1).max(200).optional(),
    subtitle:   z.string().max(500).optional(),
    imageUrl:   z.string().url().max(2000).optional(),
    linkUrl:    z.string().url().max(2000).optional(),
    altText:    z.string().max(300).optional(),
    position:   z.enum(bannerPositions).optional(),
    sortOrder:  z.number().int().min(0).max(999).optional(),
    isActive:   z.boolean().optional(),
    startsAt:   z.string().datetime().optional(),
    endsAt:     z.string().datetime().optional(),
    targetRole: z.enum(["USER", "AFFILIATE", "ADMIN"]).optional(),
  })
  .strict();

export const bannerParamSchema = z.object({ id: uuidSchema });

export const publicBannersQuerySchema = z.object({
  position: z.enum(bannerPositions).optional(),
});

export type AdminCommissionsQuery       = z.infer<typeof adminCommissionsQuerySchema>;
export type AdminApproveCommissionBody  = z.infer<typeof adminApproveCommissionSchema>;
export type AdminPayCommissionBody      = z.infer<typeof adminPayCommissionSchema>;
export type AdminAffiliateDetailParam   = z.infer<typeof adminAffiliateDetailParamSchema>;
export type AdminStatsQuery             = z.infer<typeof adminStatsQuerySchema>;
export type CreateBannerBody            = z.infer<typeof createBannerSchema>;
export type UpdateBannerBody            = z.infer<typeof updateBannerSchema>;
export type BannerParam                 = z.infer<typeof bannerParamSchema>;
export type PublicBannersQuery          = z.infer<typeof publicBannersQuerySchema>;
