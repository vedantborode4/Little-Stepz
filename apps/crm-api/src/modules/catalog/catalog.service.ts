import { prisma, type Prisma, type Tx } from "@repo/crm-db/client";
import type { NamedEntityDto, NamedEntityInput, UpdateNamedEntityInput } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
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

type NamedRow = { id: string; name: string; isActive: boolean; _count: { products: number } };

const toDto = (row: NamedRow): NamedEntityDto => ({
  id: row.id,
  name: row.name,
  isActive: row.isActive,
  productCount: row._count.products,
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

export async function createNamed(kind: NamedKind, input: NamedEntityInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    await assertNameFree(tx, kind, input.name);
    const row = await delegate(tx, kind).create({
      data: { name: input.name.trim(), nameKey: nameKey(input.name), isActive: input.isActive },
      include: withCount,
    });
    await recordAudit(tx, ctx, { action: META[kind].created, entity: META[kind].entity, entityId: row.id, after: toDto(row) });
    return toDto(row);
  });
}

export async function updateNamed(kind: NamedKind, id: string, input: UpdateNamedEntityInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await delegate(tx, kind).findUnique({ where: { id }, include: withCount });
    if (!before) throw notFound(META[kind].label);
    if (input.name) await assertNameFree(tx, kind, input.name, id);

    const after = await delegate(tx, kind).update({
      where: { id },
      data: {
        ...(input.name && { name: input.name.trim(), nameKey: nameKey(input.name) }),
        isActive: input.isActive,
      },
      include: withCount,
    });
    await recordAudit(tx, ctx, {
      action: META[kind].updated,
      entity: META[kind].entity,
      entityId: id,
      before: toDto(before),
      after: toDto(after),
    });
    return toDto(after);
  });
}
