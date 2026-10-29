import { prisma, type BusinessProfile, type Location, type ReceivingAccount } from "@repo/crm-db/client";
import type {
  BusinessProfileDto,
  BusinessProfileInput,
  LocationDto,
  ReceivingAccountDto,
  CreateLocationInput,
  CreateReceivingAccountInput,
  UpdateLocationInput,
  UpdateReceivingAccountInput,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";

const PROFILE_ID = "default";

export const toBusinessProfileDto = (p: BusinessProfile): BusinessProfileDto => ({
  legalName: p.legalName,
  tradeName: p.tradeName,
  gstin: p.gstin,
  stateCode: p.stateCode,
  addressLine: p.addressLine,
  city: p.city,
  pincode: p.pincode,
  phone: p.phone,
  email: p.email,
  receiptFooter: p.receiptFooter,
  updatedAt: p.updatedAt.toISOString(),
});

export const toLocationDto = (l: Location): LocationDto => ({
  id: l.id,
  code: l.code,
  name: l.name,
  type: l.type,
  address: l.address,
  isActive: l.isActive,
});

export const toReceivingAccountDto = (a: ReceivingAccount): ReceivingAccountDto => ({
  id: a.id,
  name: a.name,
  method: a.method,
  isPersonal: a.isPersonal,
  feePercent: a.feePercent.toFixed(2),
  details: a.details,
  isActive: a.isActive,
});

// ─── Business profile ────────────────────────────────────────────────────────

export async function getBusinessProfile() {
  const profile = await prisma.businessProfile.findUnique({ where: { id: PROFILE_ID } });
  return profile ? toBusinessProfileDto(profile) : null;
}

export async function saveBusinessProfile(input: BusinessProfileInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await tx.businessProfile.findUnique({ where: { id: PROFILE_ID } });
    const after = await tx.businessProfile.upsert({
      where: { id: PROFILE_ID },
      create: { id: PROFILE_ID, ...input },
      update: input,
    });
    await recordAudit(tx, ctx, {
      action: "business_profile.updated",
      entity: "BusinessProfile",
      entityId: PROFILE_ID,
      before: before && toBusinessProfileDto(before),
      after: toBusinessProfileDto(after),
    });
    return toBusinessProfileDto(after);
  });
}

// ─── Locations ───────────────────────────────────────────────────────────────

export async function listLocations(includeInactive: boolean) {
  const rows = await prisma.location.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map(toLocationDto);
}

export async function createLocation(input: CreateLocationInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const location = await tx.location.create({ data: input });
    await recordAudit(tx, ctx, { action: "location.created", entity: "Location", entityId: location.id, after: toLocationDto(location) });
    return toLocationDto(location);
  });
}

export async function updateLocation(id: string, input: UpdateLocationInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await tx.location.findUnique({ where: { id } });
    if (!before) throw notFound("Location");

    if (before.isActive && input.isActive === false) {
      const otherActive = await tx.location.count({ where: { isActive: true, id: { not: id } } });
      if (otherActive === 0) throw new ApiError(409, "LAST_LOCATION", "At least one active location is required");
    }

    const after = await tx.location.update({ where: { id }, data: input });
    await recordAudit(tx, ctx, {
      action: "location.updated",
      entity: "Location",
      entityId: id,
      before: toLocationDto(before),
      after: toLocationDto(after),
    });
    return toLocationDto(after);
  });
}

// ─── Receiving accounts ──────────────────────────────────────────────────────

export async function listReceivingAccounts(includeInactive: boolean) {
  const rows = await prisma.receivingAccount.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ isActive: "desc" }, { method: "asc" }, { name: "asc" }],
  });
  return rows.map(toReceivingAccountDto);
}

export async function createReceivingAccount(input: CreateReceivingAccountInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const account = await tx.receivingAccount.create({ data: input });
    await recordAudit(tx, ctx, {
      action: "receiving_account.created",
      entity: "ReceivingAccount",
      entityId: account.id,
      after: toReceivingAccountDto(account),
    });
    return toReceivingAccountDto(account);
  });
}

export async function updateReceivingAccount(id: string, input: UpdateReceivingAccountInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await tx.receivingAccount.findUnique({ where: { id } });
    if (!before) throw notFound("Receiving account");

    const after = await tx.receivingAccount.update({ where: { id }, data: input });
    await recordAudit(tx, ctx, {
      action: "receiving_account.updated",
      entity: "ReceivingAccount",
      entityId: id,
      before: toReceivingAccountDto(before),
      after: toReceivingAccountDto(after),
    });
    return toReceivingAccountDto(after);
  });
}
