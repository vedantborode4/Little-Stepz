import { Prisma, type Tx } from "@repo/crm-db/client";
import {
  MAX_OPTIONS,
  type AddOptionInput,
  type RenameOptionInput,
  type RenameOptionValueInput,
  type ReorderOptionsInput,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { DEFAULT_VARIANT_NAME, loadProductDetail, optionKeyOf } from "./products.service";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Serializes option edits (and variant adds) on one product; archived products are read-only. */
export async function lockProduct(tx: Tx, productId: string) {
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
  const product = await tx.product.findUnique({
    where: { id: productId },
    include: { options: { orderBy: { position: "asc" }, include: { values: { orderBy: { position: "asc" } } } } },
  });
  if (!product) throw notFound("Product");
  if (product.status === "ARCHIVED") throw new ApiError(409, "PRODUCT_ARCHIVED", "Restore the product before changing its options");
  return product;
}

function findOption(product: Awaited<ReturnType<typeof lockProduct>>, optionId: string) {
  const option = product.options.find((o) => o.id === optionId);
  if (!option) throw notFound("Option");
  return option;
}

/**
 * Rewrites every variant's name (its values in option order, or "Default") and
 * combination key from the product's current options, so they can never drift.
 */
async function rebuildVariants(tx: Tx, productId: string) {
  const options = await tx.productOption.findMany({
    where: { productId },
    orderBy: { position: "asc" },
    include: { values: true },
  });
  const valueInfo = new Map(options.flatMap((o, i) => o.values.map((v) => [v.id, { position: i, value: v.value }])));
  const variants = await tx.variant.findMany({ where: { productId }, include: { optionValues: true } });
  for (const variant of variants) {
    const ids = variant.optionValues.map((ov) => ov.optionValueId).sort((a, b) => valueInfo.get(a)!.position - valueInfo.get(b)!.position);
    const name = ids.length ? ids.map((id) => valueInfo.get(id)!.value).join(" / ") : DEFAULT_VARIANT_NAME;
    const optionKey = optionKeyOf(ids);
    if (name !== variant.name || optionKey !== variant.optionKey) {
      await tx.variant.update({ where: { id: variant.id }, data: { name, optionKey } });
    }
  }
}

async function renumberOptions(tx: Tx, productId: string) {
  const options = await tx.productOption.findMany({ where: { productId }, orderBy: { position: "asc" } });
  for (const [position, option] of options.entries()) {
    if (option.position !== position) await tx.productOption.update({ where: { id: option.id }, data: { position } });
  }
}

const skusOf = (tx: Tx, productId: string) =>
  tx.variant.findMany({ where: { productId }, orderBy: { position: "asc" }, select: { sku: true } }).then((r) => r.map((v) => v.sku));

/** Adds an option; every existing variant (active or archived) gets `existingValue` for it. */
export async function addOption(productId: string, input: AddOptionInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    if (product.options.length >= MAX_OPTIONS) {
      throw new ApiError(409, "TOO_MANY_OPTIONS", `A product can have at most ${MAX_OPTIONS} options`);
    }
    if (product.options.some((o) => same(o.name, input.name))) {
      throw new ApiError(409, "OPTION_EXISTS", `${product.code} already has an option called ${input.name}`, {
        fieldErrors: { name: ["Already an option of this product"] },
      });
    }

    const option = await tx.productOption.create({
      data: {
        productId,
        name: input.name,
        position: product.options.length,
        values: { create: { value: input.existingValue, position: 0 } },
      },
      include: { values: true },
    });
    const variants = await tx.variant.findMany({ where: { productId }, select: { id: true } });
    await tx.variantOptionValue.createMany({
      data: variants.map((v) => ({ variantId: v.id, optionValueId: option.values[0]!.id })),
    });
    await rebuildVariants(tx, productId);

    await recordAudit(tx, ctx, {
      action: "product.option_added",
      entity: "Product",
      entityId: productId,
      after: { option: input.name, existingValue: input.existingValue, variants: await skusOf(tx, productId) },
    });
    return loadProductDetail(tx, productId);
  });
}

export async function renameOption(productId: string, optionId: string, input: RenameOptionInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    const option = findOption(product, optionId);
    if (product.options.some((o) => o.id !== optionId && same(o.name, input.name))) {
      throw new ApiError(409, "OPTION_EXISTS", `${product.code} already has an option called ${input.name}`, {
        fieldErrors: { name: ["Already an option of this product"] },
      });
    }
    await tx.productOption.update({ where: { id: optionId }, data: { name: input.name } });
    await recordAudit(tx, ctx, {
      action: "product.option_renamed",
      entity: "Product",
      entityId: productId,
      before: { option: option.name },
      after: { option: input.name },
    });
    return loadProductDetail(tx, productId);
  });
}

export async function reorderOptions(productId: string, input: ReorderOptionsInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    const current = product.options.map((o) => o.id);
    const sameSet = new Set(input.optionIds).size === current.length && input.optionIds.every((id) => current.includes(id));
    if (input.optionIds.length !== current.length || !sameSet) {
      throw new ApiError(400, "OPTION_ORDER_INVALID", "List every option of this product exactly once");
    }
    for (const [position, id] of input.optionIds.entries()) {
      await tx.productOption.update({ where: { id }, data: { position } });
    }
    await rebuildVariants(tx, productId);
    const nameOf = new Map(product.options.map((o) => [o.id, o.name]));
    await recordAudit(tx, ctx, {
      action: "product.options_reordered",
      entity: "Product",
      entityId: productId,
      before: { options: product.options.map((o) => o.name) },
      after: { options: input.optionIds.map((id) => nameOf.get(id)) },
    });
    return loadProductDetail(tx, productId);
  });
}

/**
 * Removes an option when its variants stay distinguishable without it (in practice:
 * it has a single value, or the product has a single variant). Removing the last
 * option turns the product back into a simple product with one "Default" variant.
 */
export async function removeOption(productId: string, optionId: string, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    const option = findOption(product, optionId);
    const removedIds = new Set(option.values.map((v) => v.id));

    const variants = await tx.variant.findMany({
      where: { productId },
      orderBy: { position: "asc" },
      include: { optionValues: true },
    });
    const byKey = new Map<string, (typeof variants)[number]>();
    for (const variant of variants) {
      const key = optionKeyOf(variant.optionValues.map((ov) => ov.optionValueId).filter((id) => !removedIds.has(id)));
      const clash = byKey.get(key);
      if (clash) {
        throw new ApiError(
          409,
          "OPTION_STILL_NEEDED",
          `Removing ${option.name} would make ${clash.name} (${clash.sku}) and ${variant.name} (${variant.sku}) the same variant`,
        );
      }
      byKey.set(key, variant);
    }

    await tx.variantOptionValue.deleteMany({ where: { optionValueId: { in: [...removedIds] } } });
    await tx.productOptionValue.deleteMany({ where: { optionId } });
    await tx.productOption.delete({ where: { id: optionId } });
    await renumberOptions(tx, productId);
    await rebuildVariants(tx, productId);

    await recordAudit(tx, ctx, {
      action: "product.option_removed",
      entity: "Product",
      entityId: productId,
      before: { option: option.name, values: option.values.map((v) => v.value) },
      after: { variants: await skusOf(tx, productId) },
    });
    return loadProductDetail(tx, productId);
  });
}

export async function renameOptionValue(
  productId: string,
  optionId: string,
  valueId: string,
  input: RenameOptionValueInput,
  ctx: RequestContext,
) {
  return withTransaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    const option = findOption(product, optionId);
    const value = option.values.find((v) => v.id === valueId);
    if (!value) throw notFound("Option value");
    if (option.values.some((v) => v.id !== valueId && same(v.value, input.value))) {
      throw new ApiError(409, "VALUE_EXISTS", `${option.name} already has a value called ${input.value}`, {
        fieldErrors: { value: [`Already a ${option.name} value`] },
      });
    }
    await tx.productOptionValue.update({ where: { id: valueId }, data: { value: input.value } });
    await rebuildVariants(tx, productId);
    await recordAudit(tx, ctx, {
      action: "product.option_value_renamed",
      entity: "Product",
      entityId: productId,
      before: { option: option.name, value: value.value },
      after: { option: option.name, value: input.value },
    });
    return loadProductDetail(tx, productId);
  });
}

/**
 * Stops offering a value by archiving every active variant that uses it. Variants are
 * never deleted (their price history is append-only); restoring one brings the value back.
 */
export async function removeOptionValue(productId: string, optionId: string, valueId: string, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    const option = findOption(product, optionId);
    const value = option.values.find((v) => v.id === valueId);
    if (!value) throw notFound("Option value");

    const targets = await tx.variant.findMany({
      where: { productId, status: "ACTIVE", optionValues: { some: { optionValueId: valueId } } },
      orderBy: { position: "asc" },
      select: { id: true, sku: true },
    });
    if (targets.length === 0) return loadProductDetail(tx, productId);
    await tx.$queryRaw`SELECT id FROM "Variant" WHERE id IN (${Prisma.join(targets.map((t) => t.id))}) ORDER BY id FOR UPDATE`;

    const stocked = await tx.stockBalance.groupBy({
      by: ["variantId"],
      where: { variantId: { in: targets.map((t) => t.id) } },
      _sum: { quantity: true },
    });
    const withStock = targets.filter((t) => stocked.some((s) => s.variantId === t.id && (s._sum.quantity ?? 0) > 0));
    if (withStock.length) {
      throw new ApiError(
        409,
        "VARIANT_HAS_STOCK",
        `${withStock.map((t) => t.sku).join(", ")} still ${withStock.length === 1 ? "has" : "have"} stock. Sell, transfer or write it off first.`,
      );
    }
    const othersActive = await tx.variant.count({
      where: { productId, status: "ACTIVE", id: { notIn: targets.map((t) => t.id) } },
    });
    if (othersActive === 0) {
      throw new ApiError(409, "LAST_ACTIVE_VARIANT", "A product needs at least one active variant. Archive the product instead.");
    }

    await tx.variant.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { status: "ARCHIVED" } });
    await recordAudit(tx, ctx, {
      action: "product.option_value_removed",
      entity: "Product",
      entityId: productId,
      before: { option: option.name, value: value.value },
      after: { archivedVariants: targets.map((t) => t.sku) },
    });
    return loadProductDetail(tx, productId);
  });
}
