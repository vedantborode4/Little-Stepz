import { z } from "zod";
import { listQuery, money, optionalFilterId, optionalId, optionalText, requiredText } from "./common";

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "DISCONTINUED", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  DISCONTINUED: "Discontinued",
  ARCHIVED: "Archived",
};

export const VARIANT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export const PRICE_FIELDS = ["REGULAR", "OFFER", "WHOLESALE"] as const;
export type PriceField = (typeof PRICE_FIELDS)[number];
export const PRICE_FIELD_LABELS: Record<PriceField, string> = {
  REGULAR: "Regular price",
  OFFER: "Offer price",
  WHOLESALE: "Wholesale price",
};

/** Common GST slabs. The owner's CA confirms the rate per HSN; this list only guards typos. */
export const GST_RATES = ["0", "0.25", "3", "5", "12", "18", "28", "40"] as const;
export type GstRate = (typeof GST_RATES)[number];

/** A GST choice that may be left blank: "" and null both mean "use the category's rate" (or none, on a category). */
export const optionalGstRate = z.union([z.literal(""), z.null(), z.enum(GST_RATES, "Choose a GST rate")]).transform((v) => v || null);

export const CURRENCIES = [
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "CNY", label: "RMB — Chinese Yuan" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "HKD", label: "HKD — Hong Kong Dollar" },
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];

export const MAX_OPTIONS = 3;
export const MAX_VARIANTS_PER_PRODUCT = 200;

// ─── Building blocks ─────────────────────────────────────────────────────────

const positiveMoney = money.refine((v) => Number(v) > 0, "Must be greater than 0");

/** Cleared inputs ("") and null both mean "no price". */
const optionalMoney = z
  .union([z.literal(""), z.null(), positiveMoney])
  .transform((v) => (v === "" ? null : v))
  .optional();

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9\-_./]{1,39}$/, "2–40 characters: letters, digits, - _ . /");

const externalId = optionalText(100);
const httpsUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(
    z
      .url({ protocol: /^https$/, message: "Use an https:// link" })
      .max(500)
      .nullable(),
  )
  .nullish();

const reorderLevel = z.coerce.number().int().min(0).max(1_000_000);

/** Optional reference picked from a select: "" (nothing chosen) means none. */
function checkPriceOrder(v: { regularPrice?: string; offerPrice?: string | null; wholesalePrice?: string | null }, ctx: z.RefinementCtx) {
  if (!v.regularPrice) return;
  const regular = Number(v.regularPrice);
  if (v.offerPrice && Number(v.offerPrice) > regular) {
    ctx.addIssue({ code: "custom", path: ["offerPrice"], message: "Offer price can't be above the regular price" });
  }
  if (v.wholesalePrice && Number(v.wholesalePrice) > regular) {
    ctx.addIssue({ code: "custom", path: ["wholesalePrice"], message: "Wholesale price can't be above the regular price" });
  }
}

// ─── Categories, brands, suppliers ───────────────────────────────────────────

export const namedEntitySchema = z.object({
  name: requiredText(60),
  isActive: z.boolean().default(true),
});
export const updateNamedEntitySchema = z.object({ name: requiredText(60), isActive: z.boolean() }).partial();
export type NamedEntityInput = z.infer<typeof namedEntitySchema>;
export type UpdateNamedEntityInput = z.infer<typeof updateNamedEntitySchema>;

/** A category also carries the GST rate its products use unless they have their own. */
export const categorySchema = namedEntitySchema.extend({ gstRate: optionalGstRate.default(null) });
export const updateCategorySchema = updateNamedEntitySchema.extend({ gstRate: optionalGstRate.optional() });
export type CategoryInput = z.infer<typeof categorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

const supplierFields = {
  name: requiredText(120),
  country: optionalText(60),
  currency: z.enum(CURRENCY_CODES),
  contactName: optionalText(80),
  phone: optionalText(30),
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("Enter a valid email").nullable())
    .nullish(),
  address: optionalText(300),
  gstin: optionalText(15),
  notes: optionalText(2000),
  isActive: z.boolean(),
};
export const createSupplierSchema = z.object({
  ...supplierFields,
  currency: supplierFields.currency.default("INR"),
  isActive: supplierFields.isActive.default(true),
});
export const updateSupplierSchema = z.object(supplierFields).partial();
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

// ─── Products & variants ─────────────────────────────────────────────────────

const productFields = {
  name: requiredText(160),
  categoryId: z.string().uuid("Choose a category"),
  brandId: optionalId,
  supplierId: optionalId,
  scale: optionalText(20),
  status: z.enum(PRODUCT_STATUSES),
  imageUrl: httpsUrl,
  description: optionalText(4000),
  notes: optionalText(2000),
  hsnCode: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(
      z
        .string()
        .regex(/^\d{4,8}$/, "HSN is 4–8 digits")
        .nullable(),
    )
    .nullish(),
  /** null follows the category's rate (and keeps following it when that changes). */
  gstRate: optionalGstRate,
  websiteProductId: externalId,
};

const variantPriceFields = {
  regularPrice: positiveMoney,
  offerPrice: optionalMoney,
  wholesalePrice: optionalMoney,
  reorderLevel: reorderLevel.default(0),
};

export const variantInputSchema = z
  .object({
    sku: skuSchema,
    /** One value per product option, in option order. Empty for a simple product. */
    optionValues: z.array(requiredText(40)).default([]),
    websiteVariantId: externalId,
    ...variantPriceFields,
  })
  .superRefine(checkPriceOrder);
export type VariantInput = z.infer<typeof variantInputSchema>;

const optionInput = z.object({
  name: requiredText(30),
  values: z.array(requiredText(40)).min(1, "Add at least one value").max(50),
});

const lower = (s: string) => s.trim().toLowerCase();

export const createProductSchema = z
  .object({
    ...productFields,
    status: productFields.status.default("ACTIVE"),
    options: z.array(optionInput).max(MAX_OPTIONS).default([]),
    variants: z.array(variantInputSchema).min(1, "Add at least one variant").max(MAX_VARIANTS_PER_PRODUCT),
  })
  .superRefine((p, ctx) => {
    const optionNames = p.options.map((o) => lower(o.name));
    if (new Set(optionNames).size !== optionNames.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Option names must be unique" });
    }
    p.options.forEach((o, i) => {
      if (new Set(o.values.map(lower)).size !== o.values.length) {
        ctx.addIssue({ code: "custom", path: ["options", i, "values"], message: `"${o.name}" has duplicate values` });
      }
    });

    if (p.options.length === 0 && p.variants.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "A product without options has exactly one variant" });
    }

    const combos = new Set<string>();
    const skus = new Set<string>();
    p.variants.forEach((v, i) => {
      if (v.optionValues.length !== p.options.length) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "optionValues"], message: "Pick one value for every option" });
        return;
      }
      v.optionValues.forEach((value, j) => {
        if (!p.options[j]!.values.some((ov) => lower(ov) === lower(value))) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", i, "optionValues"],
            message: `"${value}" is not a value of ${p.options[j]!.name}`,
          });
        }
      });
      const combo = v.optionValues.map(lower).join("|");
      if (combos.has(combo)) ctx.addIssue({ code: "custom", path: ["variants", i], message: "Duplicate option combination" });
      combos.add(combo);
      if (skus.has(v.sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: `SKU ${v.sku} is used twice` });
      skus.add(v.sku);
    });
  });
export type CreateProductInput = z.infer<typeof createProductSchema>;

/** Photos are managed through the gallery, so a product edit never touches `imageUrl`. */
export const updateProductSchema = z.object(productFields).omit({ imageUrl: true }).partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const addVariantSchema = variantInputSchema;

export const updateVariantSchema = z
  .object({
    sku: skuSchema,
    regularPrice: positiveMoney,
    offerPrice: optionalMoney,
    wholesalePrice: optionalMoney,
    reorderLevel,
    websiteVariantId: externalId,
    status: z.enum(VARIANT_STATUSES),
    reason: optionalText(200),
  })
  .partial();
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const priceTiersSchema = z
  .object({
    tiers: z
      .array(z.object({ minQty: z.coerce.number().int().min(2, "Tiers start at 2 units").max(1_000_000), price: positiveMoney }))
      .max(10),
  })
  .superRefine(({ tiers }, ctx) => {
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i]!.minQty <= tiers[i - 1]!.minQty) {
        ctx.addIssue({ code: "custom", path: ["tiers", i, "minQty"], message: "Quantities must increase" });
      }
      if (Number(tiers[i]!.price) > Number(tiers[i - 1]!.price)) {
        ctx.addIssue({ code: "custom", path: ["tiers", i, "price"], message: "Larger quantities can't cost more per unit" });
      }
    }
  });
export type PriceTiersInput = z.infer<typeof priceTiersSchema>;

export const PRODUCT_MAPPING_STATES = ["MAPPED", "PARTIAL", "UNMAPPED"] as const;
export type MappingState = (typeof PRODUCT_MAPPING_STATES)[number];
export const MAPPING_STATE_LABELS: Record<MappingState, string> = {
  MAPPED: "Mapped",
  PARTIAL: "Partly mapped",
  UNMAPPED: "Not mapped",
};

export const productListQuery = listQuery.extend({
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});
export type ProductListQuery = z.infer<typeof productListQuery>;

export const mappingListQuery = listQuery.extend({
  state: z.enum(PRODUCT_MAPPING_STATES).optional(),
  categoryId: z.string().uuid().optional(),
});
export type MappingListQuery = z.infer<typeof mappingListQuery>;

export const setMappingSchema = z.object({
  websiteProductId: externalId,
  websiteVariantId: externalId,
});
export type SetMappingInput = z.infer<typeof setMappingSchema>;

// ─── Bulk pricing ────────────────────────────────────────────────────────────

export const BULK_PRICE_OPERATIONS = [
  "SET_AMOUNT",
  "INCREASE_PERCENT",
  "DECREASE_PERCENT",
  "INCREASE_AMOUNT",
  "DECREASE_AMOUNT",
  "PERCENT_OFF_REGULAR",
  "CLEAR",
] as const;
export type BulkPriceOperation = (typeof BULK_PRICE_OPERATIONS)[number];
export const BULK_PRICE_OPERATION_LABELS: Record<BulkPriceOperation, string> = {
  SET_AMOUNT: "Set to an amount",
  INCREASE_PERCENT: "Increase by %",
  DECREASE_PERCENT: "Decrease by %",
  INCREASE_AMOUNT: "Increase by ₹",
  DECREASE_AMOUNT: "Decrease by ₹",
  PERCENT_OFF_REGULAR: "% off the regular price",
  CLEAR: "Remove the price",
};

/** A filter select's "All" option sends "", which means no filter. */
export const bulkPricePreviewSchema = z
  .object({
    categoryId: optionalFilterId,
    brandId: optionalFilterId,
    q: z.string().trim().max(100).optional(),
    field: z.enum(PRICE_FIELDS),
    operation: z.enum(BULK_PRICE_OPERATIONS),
    value: money.optional(),
    roundToRupee: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.operation === "CLEAR") {
      if (v.field === "REGULAR") ctx.addIssue({ code: "custom", path: ["operation"], message: "The regular price can't be removed" });
      return;
    }
    if (v.operation === "PERCENT_OFF_REGULAR" && v.field === "REGULAR") {
      ctx.addIssue({ code: "custom", path: ["operation"], message: "Use increase/decrease for the regular price" });
    }
    if (!v.value || Number(v.value) <= 0) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter a value greater than 0" });
    if (v.operation.endsWith("PERCENT") || v.operation === "PERCENT_OFF_REGULAR") {
      if (Number(v.value) >= 100 && v.operation !== "INCREASE_PERCENT") {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Must be below 100%" });
      }
    }
  });
export type BulkPricePreviewInput = z.infer<typeof bulkPricePreviewSchema>;

export const bulkPriceApplySchema = z.object({
  field: z.enum(PRICE_FIELDS),
  reason: optionalText(200),
  changes: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        /** The price the user saw in the preview; apply refuses if it changed since. */
        expectedOldPrice: money.nullable(),
        newPrice: money.nullable(),
      }),
    )
    .min(1)
    .max(2000),
});
export type BulkPriceApplyInput = z.infer<typeof bulkPriceApplySchema>;

// ─── Product photos ──────────────────────────────────────────────────────────

export const PRODUCT_IMAGE_SOURCES = ["UPLOAD", "LINK"] as const;
export type ProductImageSource = (typeof PRODUCT_IMAGE_SOURCES)[number];

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 30;

/** The photo itself is the request body; these ride along in the query string. */
export const productImageUploadQuery = z.object({
  variantId: optionalId,
});

export const productImageLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .url({ protocol: /^https$/, message: "Use an https:// link" })
    .max(500),
  variantId: optionalId,
});
export type ProductImageLinkInput = z.infer<typeof productImageLinkSchema>;

/** Which variant a photo shows; null means the whole product. */
export const productImageUpdateSchema = z.object({ variantId: optionalId });
export type ProductImageUpdateInput = z.infer<typeof productImageUpdateSchema>;

/** Every photo of the product, in the new order; the first becomes the main photo. */
export const productImageOrderSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1).max(MAX_PRODUCT_IMAGES),
});
export type ProductImageOrderInput = z.infer<typeof productImageOrderSchema>;

export const productImageParams = z.object({ id: z.string().uuid(), imageId: z.string().uuid() });
