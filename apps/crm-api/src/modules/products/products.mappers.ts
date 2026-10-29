import type { Prisma } from "@repo/crm-db/client";
import type { MappingState, ProductDetailDto, ProductListItemDto, VariantDto } from "@repo/crm-schema";
import { money, moneyOrNull } from "../../core/money";

export const productDetailInclude = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  options: { orderBy: { position: "asc" }, include: { values: { orderBy: { position: "asc" } } } },
  variants: {
    orderBy: [{ status: "asc" }, { position: "asc" }],
    include: { optionValues: true, priceTiers: { orderBy: { minQty: "asc" } } },
  },
} satisfies Prisma.ProductInclude;

export const productListInclude = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  variants: {
    where: { status: "ACTIVE" },
    select: { regularPrice: true, offerPrice: true, websiteVariantId: true },
  },
} satisfies Prisma.ProductInclude;

type DetailRow = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;
type ListRow = Prisma.ProductGetPayload<{ include: typeof productListInclude }>;
type VariantRow = DetailRow["variants"][number];

/** Both ids present → mapped; neither → unmapped; anything in between needs attention. */
export function mappingState(productMapped: boolean, variantsMapped: boolean[]): MappingState {
  const all = [productMapped, ...variantsMapped];
  if (all.every(Boolean)) return "MAPPED";
  if (!all.some(Boolean)) return "UNMAPPED";
  return "PARTIAL";
}

export const toVariantDto = (v: VariantRow): VariantDto => ({
  id: v.id,
  sku: v.sku,
  name: v.name,
  optionValueIds: v.optionValues.map((o) => o.optionValueId),
  regularPrice: money(v.regularPrice),
  offerPrice: moneyOrNull(v.offerPrice),
  wholesalePrice: moneyOrNull(v.wholesalePrice),
  reorderLevel: v.reorderLevel,
  websiteVariantId: v.websiteVariantId,
  status: v.status,
  priceTiers: v.priceTiers.map((t) => ({ minQty: t.minQty, price: money(t.price) })),
});

export const toProductDetailDto = (p: DetailRow): ProductDetailDto => ({
  id: p.id,
  code: p.code,
  name: p.name,
  category: p.category,
  brand: p.brand,
  supplier: p.supplier,
  scale: p.scale,
  status: p.status,
  imageUrl: p.imageUrl,
  description: p.description,
  notes: p.notes,
  hsnCode: p.hsnCode,
  gstRate: p.gstRate.toString(),
  websiteProductId: p.websiteProductId,
  options: p.options.map((o) => ({ id: o.id, name: o.name, values: o.values.map((v) => ({ id: v.id, value: v.value })) })),
  variants: p.variants.map(toVariantDto),
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

export function toProductListItemDto(p: ListRow): ProductListItemDto {
  const regular = p.variants.map((v) => v.regularPrice);
  const offers = p.variants.flatMap((v) => (v.offerPrice ? [v.offerPrice] : []));
  const min = (xs: Prisma.Decimal[]) => xs.reduce((a, b) => (b.lt(a) ? b : a));
  const max = (xs: Prisma.Decimal[]) => xs.reduce((a, b) => (b.gt(a) ? b : a));
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    imageUrl: p.imageUrl,
    category: p.category,
    brand: p.brand,
    scale: p.scale,
    status: p.status,
    gstRate: p.gstRate.toString(),
    variantCount: p.variants.length,
    regularPriceMin: regular.length ? money(min(regular)) : null,
    regularPriceMax: regular.length ? money(max(regular)) : null,
    offerPriceMin: offers.length ? money(min(offers)) : null,
    mapping: mappingState(
      !!p.websiteProductId,
      p.variants.map((v) => !!v.websiteVariantId),
    ),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Product-level fields only, for audit before/after snapshots. */
export const productAuditSnapshot = (p: {
  name: string;
  categoryId: string;
  brandId: string | null;
  supplierId: string | null;
  scale: string | null;
  status: string;
  imageUrl: string | null;
  hsnCode: string | null;
  gstRate: Prisma.Decimal;
  websiteProductId: string | null;
  description: string | null;
  notes: string | null;
}) => ({
  name: p.name,
  categoryId: p.categoryId,
  brandId: p.brandId,
  supplierId: p.supplierId,
  scale: p.scale,
  status: p.status,
  imageUrl: p.imageUrl,
  hsnCode: p.hsnCode,
  gstRate: p.gstRate.toString(),
  websiteProductId: p.websiteProductId,
  description: p.description,
  notes: p.notes,
});

export const variantAuditSnapshot = (v: {
  sku: string;
  name: string;
  regularPrice: Prisma.Decimal;
  offerPrice: Prisma.Decimal | null;
  wholesalePrice: Prisma.Decimal | null;
  reorderLevel: number;
  websiteVariantId: string | null;
  status: string;
}) => ({
  sku: v.sku,
  name: v.name,
  regularPrice: money(v.regularPrice),
  offerPrice: moneyOrNull(v.offerPrice),
  wholesalePrice: moneyOrNull(v.wholesalePrice),
  reorderLevel: v.reorderLevel,
  websiteVariantId: v.websiteVariantId,
  status: v.status,
});
