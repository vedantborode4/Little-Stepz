import { prisma, type CourierPartner } from "@repo/crm-db/client";
import type { CourierDto, CreateCourierInput, UpdateCourierInput } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { nameKey } from "../../core/sequence";

export const toCourierDto = (c: CourierPartner): CourierDto => ({
  id: c.id,
  name: c.name,
  trackingUrlTemplate: c.trackingUrlTemplate,
  phone: c.phone,
  notes: c.notes,
  isActive: c.isActive,
});

/** The courier's tracking page for an AWB, or null when the courier has no link template. */
export const trackingUrl = (template: string | null | undefined, awb: string) =>
  template ? template.replace("{awb}", encodeURIComponent(awb)) : null;

const nameTaken = (name: string) =>
  new ApiError(409, "NAME_TAKEN", `Courier "${name}" already exists`, { fieldErrors: { name: [`Courier "${name}" already exists`] } });

export async function listCouriers(includeInactive: boolean) {
  const rows = await prisma.courierPartner.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: { name: "asc" } });
  return rows.map(toCourierDto);
}

export async function createCourier(input: CreateCourierInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    if (await tx.courierPartner.findUnique({ where: { nameKey: nameKey(input.name) } })) throw nameTaken(input.name);
    const courier = await tx.courierPartner.create({ data: { ...input, nameKey: nameKey(input.name) } });
    await recordAudit(tx, ctx, { action: "courier.created", entity: "CourierPartner", entityId: courier.id, after: toCourierDto(courier) });
    return toCourierDto(courier);
  });
}

export async function updateCourier(id: string, input: UpdateCourierInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await tx.courierPartner.findUnique({ where: { id } });
    if (!before) throw notFound("Courier");
    if (input.name) {
      const clash = await tx.courierPartner.findUnique({ where: { nameKey: nameKey(input.name) } });
      if (clash && clash.id !== id) throw nameTaken(input.name);
    }
    const after = await tx.courierPartner.update({
      where: { id },
      data: { ...input, ...(input.name && { nameKey: nameKey(input.name) }) },
    });
    await recordAudit(tx, ctx, {
      action: "courier.updated",
      entity: "CourierPartner",
      entityId: id,
      before: toCourierDto(before),
      after: toCourierDto(after),
    });
    return toCourierDto(after);
  });
}
