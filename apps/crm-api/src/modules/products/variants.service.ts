import { prisma } from "@repo/crm-db/client";
import type { PriceChangeDto, PriceTiersInput, UpdateVariantInput, VariantInput, VariantSearchResultDto } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { physicalStockOf } from "../inventory/inventory.service";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { dec, moneyOrNull } from "../../core/money";
import { variantAuditSnapshot } from "./products.mappers";
import { recordPriceChanges } from "./price-history";
import { assertSkusFree, assertWebsiteVariantIdFree, loadProductDetail, optionKeyOf } from "./products.service";

/**
 * Adds a variant for a new option combination. Values that don't exist yet on an
 * option (a new colour) are created. Option dimensions themselves are fixed after
 * creation: adding "Size" later would leave existing variants without a size.
 */
export async function addVariant(productId: string, input: VariantInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: { options: { orderBy: { position: "asc" }, include: { values: true } }, _count: { select: { variants: true } } },
    });
    if (!product) throw notFound("Product");
    if (product.options.length === 0) {
      throw new ApiError(409, "NO_OPTIONS", "This product has no options (colour, model…), so it has a single variant");
    }
    if (input.optionValues.length !== product.options.length) {
      throw new ApiError(400, "OPTION_VALUES_REQUIRED", "Pick one value for every option", {
        fieldErrors: { optionValues: ["Pick one value for every option"] },
      });
    }
    await assertSkusFree(tx, [input.sku]);
    await assertWebsiteVariantIdFree(tx, input.websiteVariantId);

    const resolved: { id: string; value: string }[] = [];
    for (const [i, option] of product.options.entries()) {
      const wanted = input.optionValues[i]!.trim();
      const existing = option.values.find((v) => v.value.toLowerCase() === wanted.toLowerCase());
      resolved.push(
        existing ?? (await tx.productOptionValue.create({ data: { optionId: option.id, value: wanted, position: option.values.length } })),
      );
    }

    const optionKey = optionKeyOf(resolved.map((r) => r.id));
    const duplicate = await tx.variant.findUnique({ where: { productId_optionKey: { productId, optionKey } } });
    if (duplicate) throw new ApiError(409, "COMBINATION_EXISTS", `This combination already exists as ${duplicate.sku}`);

    const variant = await tx.variant.create({
      data: {
        productId,
        sku: input.sku,
        name: resolved.map((r) => r.value).join(" / "),
        optionKey,
        regularPrice: dec(input.regularPrice),
        offerPrice: input.offerPrice ? dec(input.offerPrice) : null,
        wholesalePrice: input.wholesalePrice ? dec(input.wholesalePrice) : null,
        reorderLevel: input.reorderLevel,
        websiteVariantId: input.websiteVariantId ?? null,
        position: product._count.variants,
        optionValues: { create: resolved.map((r) => ({ optionValueId: r.id })) },
      },
    });
    await recordPriceChanges(tx, variant.id, null, variant, { changedById: ctx.userId, reason: "Variant added" });
    await recordAudit(tx, ctx, {
      action: "variant.created",
      entity: "Variant",
      entityId: variant.id,
      after: variantAuditSnapshot(variant),
    });

    return loadProductDetail(tx, productId);
  });
}

export async function updateVariant(id: string, input: UpdateVariantInput, ctx: RequestContext) {
  const { reason, ...changes } = input;
  return withTransaction(async (tx) => {
    const before = await tx.variant.findUnique({ where: { id } });
    if (!before) throw notFound("Variant");
    if (changes.sku && changes.sku !== before.sku) await assertSkusFree(tx, [changes.sku], id);
    await assertWebsiteVariantIdFree(tx, changes.websiteVariantId, id);

    const regular = changes.regularPrice ? dec(changes.regularPrice) : before.regularPrice;
    const offer = changes.offerPrice !== undefined ? (changes.offerPrice ? dec(changes.offerPrice) : null) : before.offerPrice;
    const wholesale =
      changes.wholesalePrice !== undefined ? (changes.wholesalePrice ? dec(changes.wholesalePrice) : null) : before.wholesalePrice;
    if (offer && offer.gt(regular)) {
      throw new ApiError(400, "OFFER_ABOVE_REGULAR", "Offer price can't be above the regular price", {
        fieldErrors: { offerPrice: ["Can't be above the regular price"] },
      });
    }
    if (wholesale && wholesale.gt(regular)) {
      throw new ApiError(400, "WHOLESALE_ABOVE_REGULAR", "Wholesale price can't be above the regular price", {
        fieldErrors: { wholesalePrice: ["Can't be above the regular price"] },
      });
    }

    if (changes.status === "ARCHIVED" && before.status !== "ARCHIVED") {
      const onHand = await physicalStockOf(tx, { variantId: id });
      if (onHand > 0) {
        throw new ApiError(
          409,
          "VARIANT_HAS_STOCK",
          `${before.sku} still has ${onHand} units in stock. Sell, transfer or write them off first.`,
        );
      }
      const othersActive = await tx.variant.count({ where: { productId: before.productId, status: "ACTIVE", id: { not: id } } });
      if (othersActive === 0) {
        throw new ApiError(409, "LAST_ACTIVE_VARIANT", "A product needs at least one active variant. Archive the product instead.");
      }
    }

    const after = await tx.variant.update({
      where: { id },
      data: {
        sku: changes.sku,
        regularPrice: regular,
        offerPrice: offer,
        wholesalePrice: wholesale,
        reorderLevel: changes.reorderLevel,
        websiteVariantId: changes.websiteVariantId,
        status: changes.status,
      },
    });
    await recordPriceChanges(tx, id, before, after, { changedById: ctx.userId, reason });
    await recordAudit(tx, ctx, {
      action: "variant.updated",
      entity: "Variant",
      entityId: id,
      before: variantAuditSnapshot(before),
      after: variantAuditSnapshot(after),
      metadata: reason ? { reason } : undefined,
    });
    return loadProductDetail(tx, after.productId);
  });
}

export async function setPriceTiers(id: string, input: PriceTiersInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const variant = await tx.variant.findUnique({ where: { id }, include: { priceTiers: { orderBy: { minQty: "asc" } } } });
    if (!variant) throw notFound("Variant");
    const tooHigh = input.tiers.findIndex((t) => dec(t.price).gt(variant.regularPrice));
    if (tooHigh >= 0) {
      throw new ApiError(400, "TIER_ABOVE_REGULAR", "Tier prices can't be above the regular price", {
        fieldErrors: { [`tiers.${tooHigh}.price`]: ["Can't be above the regular price"] },
      });
    }

    await tx.priceTier.deleteMany({ where: { variantId: id } });
    await tx.priceTier.createMany({ data: input.tiers.map((t) => ({ variantId: id, minQty: t.minQty, price: dec(t.price) })) });

    const snapshot = (tiers: { minQty: number; price: { toFixed(n: number): string } | string }[]) =>
      tiers.map((t) => ({ minQty: t.minQty, price: typeof t.price === "string" ? t.price : t.price.toFixed(2) }));
    await recordAudit(tx, ctx, {
      action: "variant.tiers_updated",
      entity: "Variant",
      entityId: id,
      before: { sku: variant.sku, tiers: snapshot(variant.priceTiers) },
      after: { sku: variant.sku, tiers: snapshot(input.tiers) },
    });
    return loadProductDetail(tx, variant.productId);
  });
}

export async function getPriceHistory(variantId: string): Promise<PriceChangeDto[]> {
  const rows = await prisma.priceChange.findMany({
    where: { variantId },
    include: { changedBy: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    field: r.field,
    oldPrice: moneyOrNull(r.oldPrice),
    newPrice: moneyOrNull(r.newPrice),
    reason: r.reason,
    batchId: r.batchId,
    changedByName: r.changedBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

const SEARCH_LIMIT = 20;

/** Typeahead for stock and sales forms: matches SKU, variant or product name. */
export async function searchVariants(q: string, includeArchived: boolean): Promise<VariantSearchResultDto[]> {
  const rows = await prisma.variant.findMany({
    where: {
      ...(includeArchived ? {} : { status: "ACTIVE", product: { status: { not: "ARCHIVED" } } }),
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { product: { name: { contains: q, mode: "insensitive" } } },
        { product: { code: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: {
      product: { select: { id: true, code: true, name: true, imageUrl: true } },
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
    },
    orderBy: [{ product: { name: "asc" } }, { position: "asc" }],
    take: SEARCH_LIMIT,
  });
  return rows.map((v) => ({
    id: v.id,
    sku: v.sku,
    name: v.name,
    productId: v.product.id,
    productCode: v.product.code,
    productName: v.product.name,
    imageUrl: v.images[0]?.url ?? v.product.imageUrl,
    status: v.status,
  }));
}
