import { prisma, type Prisma, type Tx } from "@repo/crm-db/client";
import type { CreateProductInput, ProductListQuery, UpdateProductInput } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { buildOrderBy, pageWindow, paginated } from "../../core/list";
import { dec } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { physicalStockOf, stockTotals } from "../inventory/inventory.service";
import {
  productAuditSnapshot,
  productDetailInclude,
  productListInclude,
  toProductDetailDto,
  toProductListItemDto,
} from "./products.mappers";
import { recordPriceChanges } from "./price-history";

const SORTABLE = { name: "name", code: "code", updatedAt: "updatedAt", createdAt: "createdAt", category: "category.name" };

export const DEFAULT_VARIANT_NAME = "Default";

export async function listProducts(query: ProductListQuery) {
  const where: Prisma.ProductWhereInput = {
    categoryId: query.categoryId,
    brandId: query.brandId,
    status: query.status ?? { not: "ARCHIVED" },
    ...(query.q && {
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { code: { contains: query.q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: query.q, mode: "insensitive" } } } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productListInclude,
      orderBy: buildOrderBy(query.sort, SORTABLE, "name:asc"),
      ...pageWindow(query),
    }),
    prisma.product.count({ where }),
  ]);
  const stock = await stockTotals(rows.flatMap((p) => p.variants.map((v) => v.id)));
  return paginated(
    rows.map((p) => toProductListItemDto(p, stock)),
    total,
    query,
  );
}

/** Product detail with live stock per variant; every product response goes through here. */
export async function loadProductDetail(db: Tx | typeof prisma, id: string) {
  const product = await db.product.findUnique({ where: { id }, include: productDetailInclude });
  if (!product) throw notFound("Product");
  return toProductDetailDto(product, await stockTotals(product.variants.map((v) => v.id)));
}

export const getProduct = (id: string) => loadProductDetail(prisma, id);

/** Category must be active for new assignments; brand and supplier must exist. */
async function assertReferences(tx: Tx, input: { categoryId?: string; brandId?: string | null; supplierId?: string | null }) {
  if (input.categoryId) {
    const category = await tx.category.findUnique({ where: { id: input.categoryId } });
    if (!category?.isActive)
      throw new ApiError(400, "INVALID_CATEGORY", "Choose an active category", {
        fieldErrors: { categoryId: ["Choose an active category"] },
      });
  }
  if (input.brandId && !(await tx.brand.findUnique({ where: { id: input.brandId } }))) {
    throw new ApiError(400, "INVALID_BRAND", "Brand not found", { fieldErrors: { brandId: ["Brand not found"] } });
  }
  if (input.supplierId && !(await tx.supplier.findUnique({ where: { id: input.supplierId } }))) {
    throw new ApiError(400, "INVALID_SUPPLIER", "Supplier not found", { fieldErrors: { supplierId: ["Supplier not found"] } });
  }
}

export async function assertSkusFree(tx: Tx, skus: string[], exceptVariantId?: string) {
  const taken = await tx.variant.findMany({
    where: { sku: { in: skus }, id: exceptVariantId ? { not: exceptVariantId } : undefined },
    select: { sku: true },
  });
  if (taken.length) {
    const list = taken.map((t) => t.sku).join(", ");
    throw new ApiError(409, "SKU_TAKEN", `SKU already in use: ${list}`, {
      skus: taken.map((t) => t.sku),
      fieldErrors: { sku: [`Already in use: ${list}`] },
    });
  }
}

export async function assertWebsiteProductIdFree(tx: Tx, websiteProductId: string | null | undefined, exceptProductId?: string) {
  if (!websiteProductId) return;
  const clash = await tx.product.findUnique({ where: { websiteProductId }, select: { id: true, code: true } });
  if (clash && clash.id !== exceptProductId) {
    throw new ApiError(409, "WEBSITE_ID_IN_USE", `That website product ID is already mapped to ${clash.code}`, {
      fieldErrors: { websiteProductId: [`Already mapped to ${clash.code}`] },
    });
  }
}

export async function assertWebsiteVariantIdFree(tx: Tx, websiteVariantId: string | null | undefined, exceptVariantId?: string) {
  if (!websiteVariantId) return;
  const clash = await tx.variant.findUnique({ where: { websiteVariantId }, select: { id: true, sku: true } });
  if (clash && clash.id !== exceptVariantId) {
    throw new ApiError(409, "WEBSITE_ID_IN_USE", `That website variant ID is already mapped to ${clash.sku}`, {
      fieldErrors: { websiteVariantId: [`Already mapped to ${clash.sku}`] },
    });
  }
}

/** Option-value ids sorted and joined: the identity of a variant's combination. */
export const optionKeyOf = (valueIds: string[]) => [...valueIds].sort().join("|");

export async function createProduct(input: CreateProductInput, ctx: RequestContext) {
  return withTransaction(async (tx) => loadProductDetail(tx, await createProductInTx(tx, input, ctx)));
}

/** Creates a product with its options and variants inside the caller's transaction; returns its id. */
export async function createProductInTx(tx: Tx, input: CreateProductInput, ctx: RequestContext) {
  await assertReferences(tx, input);
  await assertSkusFree(
    tx,
    input.variants.map((v) => v.sku),
  );
  await assertWebsiteProductIdFree(tx, input.websiteProductId);
  for (const v of input.variants) await assertWebsiteVariantIdFree(tx, v.websiteVariantId);

  const { options, variants, ...fields } = input;
  const product = await tx.product.create({
    data: { ...fields, code: await nextCode(tx, "PRD"), gstRate: dec(fields.gstRate) },
  });
  if (product.imageUrl) {
    await tx.productImage.create({
      data: { productId: product.id, url: product.imageUrl, source: "LINK", position: 0, createdById: ctx.userId },
    });
  }

  // Value ids per option, keyed by lower-cased value, so variant rows can resolve their combination.
  const valueIdsByOption: Map<string, { id: string; value: string }>[] = [];
  for (const [position, option] of options.entries()) {
    const created = await tx.productOption.create({
      data: {
        productId: product.id,
        name: option.name.trim(),
        position,
        values: { create: option.values.map((value, i) => ({ value: value.trim(), position: i })) },
      },
      include: { values: true },
    });
    valueIdsByOption.push(new Map(created.values.map((v) => [v.value.toLowerCase(), { id: v.id, value: v.value }])));
  }

  for (const [position, v] of variants.entries()) {
    const resolved = v.optionValues.map((value, i) => valueIdsByOption[i]!.get(value.trim().toLowerCase())!);
    const variant = await tx.variant.create({
      data: {
        productId: product.id,
        sku: v.sku,
        name: resolved.length ? resolved.map((r) => r.value).join(" / ") : DEFAULT_VARIANT_NAME,
        optionKey: optionKeyOf(resolved.map((r) => r.id)),
        regularPrice: dec(v.regularPrice),
        offerPrice: v.offerPrice ? dec(v.offerPrice) : null,
        wholesalePrice: v.wholesalePrice ? dec(v.wholesalePrice) : null,
        reorderLevel: v.reorderLevel,
        websiteVariantId: v.websiteVariantId ?? null,
        position,
        optionValues: { create: resolved.map((r) => ({ optionValueId: r.id })) },
      },
    });
    await recordPriceChanges(tx, variant.id, null, variant, { changedById: ctx.userId, reason: "Product created" });
  }

  await recordAudit(tx, ctx, {
    action: "product.created",
    entity: "Product",
    entityId: product.id,
    after: { code: product.code, ...productAuditSnapshot(product), variants: variants.map((v) => v.sku) },
  });

  return product.id;
}

export async function updateProduct(id: string, input: UpdateProductInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { id } });
    if (!before) throw notFound("Product");
    await assertReferences(tx, { ...input, categoryId: input.categoryId !== before.categoryId ? input.categoryId : undefined });
    await assertWebsiteProductIdFree(tx, input.websiteProductId, id);
    if (input.status === "ARCHIVED" && before.status !== "ARCHIVED") {
      const onHand = await physicalStockOf(tx, { variant: { productId: id } });
      if (onHand > 0) {
        throw new ApiError(
          409,
          "PRODUCT_HAS_STOCK",
          `${before.code} still has ${onHand} units in stock. Sell, transfer or write them off first.`,
        );
      }
    }

    const after = await tx.product.update({
      where: { id },
      data: { ...input, gstRate: input.gstRate ? dec(input.gstRate) : undefined },
    });
    await recordAudit(tx, ctx, {
      action: "product.updated",
      entity: "Product",
      entityId: id,
      before: productAuditSnapshot(before),
      after: productAuditSnapshot(after),
    });
    return loadProductDetail(tx, id);
  });
}
