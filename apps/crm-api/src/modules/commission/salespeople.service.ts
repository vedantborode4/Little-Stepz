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

/**
 * The next staff ID: S01, S02… one past the highest S-number in use (IDs typed
 * by hand before IDs were assigned keep theirs). Serialised so two admins adding
 * people at once can't get the same ID.
 */
async function nextStaffCode(tx: Tx) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('crm.salesperson.staff_code'))`;
  const codes = await tx.salesperson.findMany({ select: { staffCode: true } });
  const highest = codes.reduce((max, { staffCode }) => {
    const n = /^S(\d+)$/.exec(staffCode);
    return n ? Math.max(max, Number(n[1])) : max;
  }, 0);
  return `S${String(highest + 1).padStart(2, "0")}`;
}

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
    const staffCode = await nextStaffCode(tx);
    const row = await tx.salesperson.create({
      data: {
        staffCode,
        staffKey: nameKey(staffCode),
        name: input.name,
        commissionRate: dec(input.commissionRate),
        isActive: input.isActive,
      },
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
    const after = await tx.salesperson.update({
      where: { id },
      data: {
        ...input,
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
