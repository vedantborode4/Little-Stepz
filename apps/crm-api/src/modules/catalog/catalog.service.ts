import { prisma, type Prisma, type Tx } from "@repo/crm-db/client";
import type { CategoryInput, NamedEntityDto, NamedEntityInput, UpdateCategoryInput } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { dec } from "../../core/money";
import { nameKey } from "../../core/sequence";

/** Categories and brands are the same shape: a unique name that products point at. */
export type NamedKind = "category" | "brand";

const META = {
  category: { label: "Category", entity: "Category", created: "category.created", updated: "category.updated" },
  brand: { label: "Brand", entity: "Brand", created: "brand.created", updated: "brand.updated" },
} as const;

/**
 * Category and Brand have identical columns, so one delegate type serves both.
 * The cast is the single place that relies on that; the schema keeps them in step.
 */
const delegate = (db: Tx | typeof prisma, kind: NamedKind) =>
  (kind === "category" ? db.category : db.brand) as unknown as Prisma.CategoryDelegate;

const withCount = { _count: { select: { products: true } } } as const;

type NamedRow = { id: string; name: string; isActive: boolean; gstRate?: Prisma.Decimal | null; _count: { products: number } };

const toDto = (row: NamedRow): NamedEntityDto => ({
  id: row.id,
  name: row.name,
  isActive: row.isActive,
  productCount: row._count.products,
  ...(row.gstRate !== undefined && { gstRate: row.gstRate?.toString() ?? null }),
});

export async function listNamed(kind: NamedKind, includeInactive: boolean) {
  const rows = await delegate(prisma, kind).findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    include: withCount,
  });
  return rows.map(toDto);
}

function duplicateName(kind: NamedKind, name: string) {
  return new ApiError(409, "NAME_TAKEN", `${META[kind].label} "${name}" already exists`, {
    fieldErrors: { name: [`${META[kind].label} "${name}" already exists`] },
  });
}

async function assertNameFree(tx: Tx, kind: NamedKind, name: string, exceptId?: string) {
  const clash = await delegate(tx, kind).findUnique({ where: { nameKey: nameKey(name) } });
  if (clash && clash.id !== exceptId) throw duplicateName(kind, clash.name);
}

export async function createNamed(kind: NamedKind, input: NamedEntityInput | CategoryInput, ctx: RequestContext) {
  return withTransaction((tx) => createNamedInTx(tx, kind, input, ctx));
}

/** Creates a category or brand inside the caller's transaction (the product import adds them as it goes). */
export async function createNamedInTx(tx: Tx, kind: NamedKind, input: NamedEntityInput | CategoryInput, ctx: RequestContext) {
  await assertNameFree(tx, kind, input.name);
  const gstRate = kind === "category" && "gstRate" in input && input.gstRate ? dec(input.gstRate) : null;
  const row = await delegate(tx, kind).create({
    data: { name: input.name.trim(), nameKey: nameKey(input.name), isActive: input.isActive, ...(kind === "category" && { gstRate }) },
    include: withCount,
  });
  await recordAudit(tx, ctx, { action: META[kind].created, entity: META[kind].entity, entityId: row.id, after: toDto(row) });
  return toDto(row);
}

export async function updateNamed(kind: NamedKind, id: string, input: UpdateCategoryInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await delegate(tx, kind).findUnique({ where: { id }, include: withCount });
    if (!before) throw notFound(META[kind].label);
    if (input.name) await assertNameFree(tx, kind, input.name, id);
    const rateChange = kind === "category" && input.gstRate !== undefined ? await categoryRateChange(tx, id, input.gstRate) : null;

    const after = await delegate(tx, kind).update({
      where: { id },
      data: {
        ...(input.name && { name: input.name.trim(), nameKey: nameKey(input.name) }),
        isActive: input.isActive,
        ...(rateChange && { gstRate: rateChange.gstRate }),
      },
      include: withCount,
    });
    await recordAudit(tx, ctx, {
      action: META[kind].updated,
      entity: META[kind].entity,
      entityId: id,
      before: toDto(before),
      after: { ...toDto(after), ...(rateChange && { productsRerated: rateChange.productsRerated }) },
    });
    return toDto(after);
  });
}

/**
 * A new category rate moves every product that follows the category with it.
 * The rate can't be cleared while products follow it: they would have none.
 */
async function categoryRateChange(tx: Tx, categoryId: string, rate: string | null) {
  const followers = { categoryId, gstFromCategory: true };
  if (rate === null) {
    const count = await tx.product.count({ where: followers });
    if (count > 0) {
      throw new ApiError(409, "CATEGORY_RATE_IN_USE", `${count} product(s) use this category's GST rate; give them their own rate first`, {
        fieldErrors: { gstRate: [`${count} product(s) use this rate`] },
      });
    }
    return { gstRate: null, productsRerated: 0 };
  }
  const gstRate = dec(rate);
  const { count } = await tx.product.updateMany({ where: followers, data: { gstRate } });
  return { gstRate, productsRerated: count };
}
