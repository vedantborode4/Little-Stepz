import { prisma, type Prisma, type Supplier } from "@repo/crm-db/client";
import type { CreateSupplierInput, CurrencyCode, ListQuery, SupplierDto, UpdateSupplierInput } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { buildOrderBy, pageWindow, paginated, searchAcross } from "../../core/list";
import { Decimal, money } from "../../core/money";
import { nameKey } from "../../core/sequence";
import { supplierBalances } from "./supplier-ledger.service";

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

/** `withBalance` is for callers allowed to see the supplier ledger; the balance is left off otherwise. */
export async function listSuppliers(query: ListQuery & { includeInactive?: boolean }, withBalance = false) {
  const where: Prisma.SupplierWhereInput = {
    isActive: query.includeInactive ? undefined : true,
    OR: searchAcross(query.q, ["name", "contactName", "phone", "country"]),
  };
  const [rows, total] = await Promise.all([
    prisma.supplier.findMany({ where, orderBy: buildOrderBy(query.sort, SORTABLE, "name:asc"), ...pageWindow(query) }),
    prisma.supplier.count({ where }),
  ]);
  if (!withBalance) return paginated(rows.map(toSupplierDto), total, query);
  const balances = await supplierBalances(rows.map((s) => s.id));
  return paginated(
    rows.map((s) => ({ ...toSupplierDto(s), balance: money(balances.get(s.id) ?? new Decimal(0)) })),
    total,
    query,
  );
}

export async function getSupplier(id: string, withBalance = false) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw notFound("Supplier");
  if (!withBalance) return toSupplierDto(supplier);
  return { ...toSupplierDto(supplier), balance: money((await supplierBalances([id])).get(id) ?? new Decimal(0)) };
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
