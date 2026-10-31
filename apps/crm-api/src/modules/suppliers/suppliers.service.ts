import { prisma, type Prisma, type Supplier } from "@repo/crm-db/client";
import type { CreateSupplierInput, CurrencyCode, ListQuery, SupplierDto, UpdateSupplierInput } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { buildOrderBy, pageWindow, paginated, searchAcross } from "../../core/list";
import { nameKey } from "../../core/sequence";

export const toSupplierDto = (s: Supplier): SupplierDto => ({
  id: s.id,
  name: s.name,
  country: s.country,
  currency: s.currency as CurrencyCode,
  contactName: s.contactName,
  phone: s.phone,
  email: s.email,
  address: s.address,
  gstin: s.gstin,
  notes: s.notes,
  isActive: s.isActive,
});

const SORTABLE = { name: "name", country: "country", createdAt: "createdAt" };

export async function listSuppliers(query: ListQuery & { includeInactive?: boolean }) {
  const where: Prisma.SupplierWhereInput = {
    isActive: query.includeInactive ? undefined : true,
    OR: searchAcross(query.q, ["name", "contactName", "phone", "country"]),
  };
  const [rows, total] = await Promise.all([
    prisma.supplier.findMany({ where, orderBy: buildOrderBy(query.sort, SORTABLE, "name:asc"), ...pageWindow(query) }),
    prisma.supplier.count({ where }),
  ]);
  return paginated(rows.map(toSupplierDto), total, query);
}

const nameTaken = (name: string) =>
  new ApiError(409, "NAME_TAKEN", `Supplier "${name}" already exists`, { fieldErrors: { name: [`Supplier "${name}" already exists`] } });

export async function createSupplier(input: CreateSupplierInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const clash = await tx.supplier.findUnique({ where: { nameKey: nameKey(input.name) } });
    if (clash) throw nameTaken(clash.name);
    const supplier = await tx.supplier.create({ data: { ...input, nameKey: nameKey(input.name) } });
    await recordAudit(tx, ctx, { action: "supplier.created", entity: "Supplier", entityId: supplier.id, after: toSupplierDto(supplier) });
    return toSupplierDto(supplier);
  });
}

export async function updateSupplier(id: string, input: UpdateSupplierInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await tx.supplier.findUnique({ where: { id } });
    if (!before) throw notFound("Supplier");
    if (input.name) {
      const clash = await tx.supplier.findUnique({ where: { nameKey: nameKey(input.name) } });
      if (clash && clash.id !== id) throw nameTaken(clash.name);
    }
    const after = await tx.supplier.update({
      where: { id },
      data: { ...input, ...(input.name && { nameKey: nameKey(input.name) }) },
    });
    await recordAudit(tx, ctx, {
      action: "supplier.updated",
      entity: "Supplier",
      entityId: id,
      before: toSupplierDto(before),
      after: toSupplierDto(after),
    });
    return toSupplierDto(after);
  });
}
