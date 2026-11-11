import { prisma, type Salesperson, type Tx } from "@repo/crm-db/client";
import type { CreateSalespersonInput, SalespersonDto, SalespersonOptionDto, UpdateSalespersonInput } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { dec } from "../../core/money";
import { nameKey } from "../../core/sequence";

export const toSalespersonDto = (s: Salesperson): SalespersonDto => ({
  id: s.id,
  staffCode: s.staffCode,
  name: s.name,
  commissionRate: s.commissionRate.toString(),
  isActive: s.isActive,
});

const codeTaken = (code: string) =>
  new ApiError(409, "STAFF_CODE_TAKEN", `Staff ID ${code} is already in use`, {
    fieldErrors: { staffCode: [`Staff ID ${code} is already in use`] },
  });

/** The till's picker: active salespeople, without their rates. */
export async function listOptions(): Promise<SalespersonOptionDto[]> {
  return prisma.salesperson.findMany({
    where: { isActive: true },
    select: { id: true, staffCode: true, name: true },
    orderBy: [{ name: "asc" }, { staffCode: "asc" }],
  });
}

export async function listSalespeople(includeInactive: boolean): Promise<SalespersonDto[]> {
  const rows = await prisma.salesperson.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map(toSalespersonDto);
}

export async function createSalesperson(input: CreateSalespersonInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const staffKey = nameKey(input.staffCode);
    if (await tx.salesperson.findUnique({ where: { staffKey } })) throw codeTaken(input.staffCode);
    const row = await tx.salesperson.create({
      data: { staffCode: input.staffCode, staffKey, name: input.name, commissionRate: dec(input.commissionRate), isActive: input.isActive },
    });
    await recordAudit(tx, ctx, { action: "salesperson.created", entity: "Salesperson", entityId: row.id, after: toSalespersonDto(row) });
    return toSalespersonDto(row);
  });
}

/** A new rate applies to sales made from now on; sales already made keep the rate frozen on them. */
export async function updateSalesperson(id: string, input: UpdateSalespersonInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await tx.salesperson.findUnique({ where: { id } });
    if (!before) throw notFound("Salesperson");
    const staffKey = input.staffCode ? nameKey(input.staffCode) : undefined;
    if (staffKey) {
      const clash = await tx.salesperson.findUnique({ where: { staffKey } });
      if (clash && clash.id !== id) throw codeTaken(input.staffCode!);
    }
    const after = await tx.salesperson.update({
      where: { id },
      data: {
        ...input,
        ...(staffKey && { staffKey }),
        ...(input.commissionRate !== undefined && { commissionRate: dec(input.commissionRate) }),
      },
    });
    await recordAudit(tx, ctx, {
      action: "salesperson.updated",
      entity: "Salesperson",
      entityId: id,
      before: toSalespersonDto(before),
      after: toSalespersonDto(after),
    });
    return toSalespersonDto(after);
  });
}

/**
 * The salesperson and rate to freeze on a sale. Null clears it. Only an active
 * salesperson can be put on a sale; their current rate is the one that sticks.
 */
export async function resolveSalesperson(tx: Tx, salespersonId: string | null | undefined) {
  if (!salespersonId) return { salespersonId: null, commissionRate: null, salesperson: null };
  const salesperson = await tx.salesperson.findUnique({ where: { id: salespersonId } });
  if (!salesperson?.isActive) {
    throw new ApiError(400, "INVALID_SALESPERSON", "Choose an active salesperson", {
      fieldErrors: { salespersonId: ["Choose an active salesperson"] },
    });
  }
  return { salespersonId: salesperson.id, commissionRate: salesperson.commissionRate, salesperson };
}
