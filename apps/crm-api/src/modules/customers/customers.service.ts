import { prisma, Prisma, type Tx } from "@repo/crm-db/client";
import {
  normalizeMobile,
  type CreateCustomerInput,
  type CustomerListQuery,
  type DuplicateCheckQuery,
  type DuplicateMatchDto,
  type DuplicatePairDto,
  type DuplicateReason,
  type MergeCustomerInput,
  type UpdateCustomerInput,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { buildOrderBy, pageWindow, paginated } from "../../core/list";
import { fromDbDate } from "../../core/dates";
import { dec, Decimal, money } from "../../core/money";
import { maskMobile } from "../../core/pii";
import { creditBalance } from "../payments/ledger";
import { customerOutstanding } from "../payments/payments.queries";
import { nameKey, nextCode } from "../../core/sequence";
import {
  auditSnapshot,
  customerDetailInclude,
  customerListInclude,
  toContactDto,
  toCustomerDetailDto,
  toCustomerListItemDto,
} from "./customers.mappers";

const SORTABLE = { name: "name", code: "code", city: "city", createdAt: "createdAt" };

/** Similarity (0–1, trigram) above which two names count as "similar" on their own. */
const SIMILAR_NAME = 0.6;
/** A lower bar applies when the PIN code also matches. */
const SIMILAR_NAME_SAME_PIN = 0.45;

/**
 * A full phone number matches exactly; four digits match the visible tail of a
 * masked number. Partial numbers otherwise don't match, so the list can't be
 * used to discover whose number is whose.
 */
function searchWhere(q: string | undefined): Prisma.CustomerWhereInput | undefined {
  if (!q) return undefined;
  const mobile = normalizeMobile(q);
  if (mobile) return { OR: [{ mobile }, { whatsapp: mobile }] };
  const or: Prisma.CustomerWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
    { code: { contains: q, mode: "insensitive" } },
    { city: { contains: q, mode: "insensitive" } },
    { email: { equals: q, mode: "insensitive" } },
  ];
  if (/^\d{4}$/.test(q)) or.push({ mobile: { endsWith: q } });
  if (/^\d{6}$/.test(q)) or.push({ pincode: q });
  return { OR: or };
}

function listWhere(query: Pick<CustomerListQuery, "q" | "type" | "includeInactive">): Prisma.CustomerWhereInput {
  return {
    isActive: query.includeInactive ? undefined : true,
    type: query.type,
    ...searchWhere(query.q),
  };
}

export async function listCustomers(query: CustomerListQuery) {
  const where = listWhere(query);
  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: customerListInclude,
      orderBy: buildOrderBy(query.sort, SORTABLE, "name:asc"),
      ...pageWindow(query),
    }),
    prisma.customer.count({ where }),
  ]);
  return paginated(rows.map(toCustomerListItemDto), total, query);
}

/** Admin export with real phone numbers and emails. The export itself is audited. */
export async function exportCustomersWithContacts(query: CustomerListQuery, ctx: RequestContext) {
  const rows = await prisma.customer.findMany({
    where: listWhere(query),
    include: customerListInclude,
    orderBy: buildOrderBy(query.sort, SORTABLE, "name:asc"),
    ...pageWindow(query),
  });
  await withTransaction((tx) =>
    recordAudit(tx, ctx, {
      action: "customer.contacts_exported",
      entity: "Customer",
      entityId: "*",
      metadata: { rows: rows.length, q: query.q ?? null, type: query.type ?? null },
    }),
  );
  return rows.map((c) => ({ ...toCustomerListItemDto(c), contact: toContactDto(c) }));
}

export async function getCustomer(id: string) {
  const [row, orders, fulfilled, returned, outstanding, credit] = await Promise.all([
    prisma.customer.findUnique({ where: { id }, include: customerDetailInclude }),
    prisma.salesOrder.aggregate({
      where: { customerId: id, status: { notIn: ["DRAFT", "CANCELLED"] } },
      _count: true,
      _max: { orderDate: true },
    }),
    prisma.salesOrder.aggregate({ where: { customerId: id, fulfilledAt: { not: null } }, _sum: { grandTotal: true } }),
    prisma.salesReturn.aggregate({ where: { order: { customerId: id } }, _sum: { amount: true } }),
    customerOutstanding(id),
    creditBalance(prisma, id),
  ]);
  if (!row) throw notFound("Customer");
  return toCustomerDetailDto(row, {
    orders: orders._count,
    lastOrderDate: orders._max.orderDate ? fromDbDate(orders._max.orderDate) : null,
    lifetimeValue: money(new Decimal((fulfilled._sum.grandTotal ?? 0).toString()).sub((returned._sum.amount ?? 0).toString())),
    outstanding: money(outstanding),
    creditBalance: money(credit),
  });
}

export async function revealContact(id: string, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const row = await tx.customer.findUnique({ where: { id }, select: { mobile: true, whatsapp: true, email: true } });
    if (!row) throw notFound("Customer");
    await recordAudit(tx, ctx, { action: "customer.contact_revealed", entity: "Customer", entityId: id });
    return toContactDto(row);
  });
}

async function assertMobileFree(tx: Tx, mobile: string | null | undefined, exceptId?: string) {
  if (!mobile) return;
  const clash = await tx.customer.findUnique({ where: { mobile }, select: { id: true, code: true, name: true } });
  if (clash && clash.id !== exceptId) {
    const message = `This mobile already belongs to ${clash.name} (${clash.code})`;
    throw new ApiError(409, "MOBILE_TAKEN", message, { fieldErrors: { mobile: [message] }, existing: clash });
  }
}

/** The unique index is the final word if two requests race past the check. */
function mapUniqueViolation(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new ApiError(409, "MOBILE_TAKEN", "This mobile already belongs to another customer", {
      fieldErrors: { mobile: ["This mobile already belongs to another customer"] },
    });
  }
  throw err;
}

export async function createCustomer(input: CreateCustomerInput, ctx: RequestContext) {
  const id = await withTransaction((tx) => createCustomerInTx(tx, input, ctx)).catch(mapUniqueViolation);
  return getCustomer(id);
}

/** Creates a customer inside the caller's transaction; returns its id. */
export async function createCustomerInTx(tx: Tx, input: CreateCustomerInput, ctx: RequestContext) {
  await assertMobileFree(tx, input.mobile);
  const customer = await tx.customer.create({
    data: {
      ...input,
      code: await nextCode(tx, "CUS", 5),
      nameKey: nameKey(input.name),
      creditLimit: input.creditLimit ? dec(input.creditLimit) : null,
    },
  });
  await recordAudit(tx, ctx, { action: "customer.created", entity: "Customer", entityId: customer.id, after: auditSnapshot(customer) });
  return customer.id;
}

export async function updateCustomer(id: string, input: UpdateCustomerInput, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    const before = await tx.customer.findUnique({ where: { id } });
    if (!before) throw notFound("Customer");
    if (before.mergedIntoId) throw new ApiError(409, "CUSTOMER_MERGED", "This customer was merged into another; edit that one instead");
    await assertMobileFree(tx, input.mobile, id);
    const after = await tx.customer.update({
      where: { id },
      data: {
        ...input,
        ...(input.name && { nameKey: nameKey(input.name) }),
        ...(input.creditLimit !== undefined && { creditLimit: input.creditLimit ? dec(input.creditLimit) : null }),
      },
    });
    await recordAudit(tx, ctx, {
      action: "customer.updated",
      entity: "Customer",
      entityId: id,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
    });
  }).catch(mapUniqueViolation);
  return getCustomer(id);
}

// ─── Duplicates ──────────────────────────────────────────────────────────────

type MatchRow = { id: string; code: string; name: string; mobile: string | null; city: string | null; pincode: string | null };

const toMatch = (row: MatchRow, reason: DuplicateReason): DuplicateMatchDto => ({
  id: row.id,
  code: row.code,
  name: row.name,
  mobile: maskMobile(row.mobile),
  city: row.city,
  pincode: row.pincode,
  reason,
});

function nameReason(similarity: number, sameName: boolean, samePin: boolean): DuplicateReason | null {
  if (sameName && samePin) return "NAME_AND_PIN";
  if (similarity >= SIMILAR_NAME || (samePin && similarity >= SIMILAR_NAME_SAME_PIN)) return "SIMILAR_NAME";
  return null;
}

/** Possible duplicates of what's being typed into the customer form. Same mobile is a hard block on save; the rest are warnings. */
export async function findDuplicates(query: DuplicateCheckQuery): Promise<DuplicateMatchDto[]> {
  const matches = new Map<string, DuplicateMatchDto>();
  const exclude = query.excludeId ?? null;

  const mobile = query.mobile ? normalizeMobile(query.mobile) : null;
  if (mobile) {
    const rows = await prisma.customer.findMany({
      where: { OR: [{ mobile }, { whatsapp: mobile }], mergedIntoId: null, id: exclude ? { not: exclude } : undefined },
      take: 5,
    });
    for (const row of rows) matches.set(row.id, toMatch(row, "MOBILE"));
  }

  const key = query.name ? nameKey(query.name) : "";
  if (key.length >= 3) {
    const pin = query.pincode && /^\d{6}$/.test(query.pincode) ? query.pincode : null;
    const rows = await prisma.$queryRaw<(MatchRow & { nameKey: string; similarity: number })[]>`
      SELECT id, code, name, mobile, city, pincode, "nameKey", similarity("nameKey", ${key})::float AS similarity
      FROM "Customer"
      WHERE "mergedIntoId" IS NULL AND "nameKey" % ${key} AND (${exclude}::text IS NULL OR id <> ${exclude})
      ORDER BY similarity DESC
      LIMIT 10`;
    for (const row of rows) {
      if (matches.has(row.id)) continue;
      const reason = nameReason(row.similarity, row.nameKey === key, pin !== null && row.pincode === pin);
      if (reason) matches.set(row.id, toMatch(row, reason));
    }
  }
  return [...matches.values()].slice(0, 8);
}

/** Pairs of active customers that look like the same person, for review and merging. */
export async function duplicatePairs(): Promise<DuplicatePairDto[]> {
  const rows = await prisma.$queryRaw<
    {
      aId: string;
      aCode: string;
      aName: string;
      aMobile: string | null;
      aCity: string | null;
      aPin: string | null;
      bId: string;
      bCode: string;
      bName: string;
      bMobile: string | null;
      bCity: string | null;
      bPin: string | null;
      sameName: boolean;
      similarity: number;
    }[]
  >`
    SELECT a.id AS "aId", a.code AS "aCode", a.name AS "aName", a.mobile AS "aMobile", a.city AS "aCity", a.pincode AS "aPin",
      b.id AS "bId", b.code AS "bCode", b.name AS "bName", b.mobile AS "bMobile", b.city AS "bCity", b.pincode AS "bPin",
      a."nameKey" = b."nameKey" AS "sameName", similarity(a."nameKey", b."nameKey")::float AS similarity
    FROM "Customer" a
    JOIN "Customer" b ON a.id < b.id AND a."nameKey" % b."nameKey"
    WHERE a."isActive" AND b."isActive" AND a."mergedIntoId" IS NULL AND b."mergedIntoId" IS NULL
    ORDER BY COALESCE(a.pincode = b.pincode, false) DESC, similarity DESC
    LIMIT 200`;

  const pairs: DuplicatePairDto[] = [];
  for (const r of rows) {
    const samePin = r.aPin !== null && r.aPin === r.bPin;
    const reason = nameReason(r.similarity, r.sameName, samePin);
    if (!reason) continue;
    pairs.push({
      reason,
      similarity: Math.round(r.similarity * 100) / 100,
      a: toMatch({ id: r.aId, code: r.aCode, name: r.aName, mobile: r.aMobile, city: r.aCity, pincode: r.aPin }, reason),
      b: toMatch({ id: r.bId, code: r.bCode, name: r.bName, mobile: r.bMobile, city: r.bCity, pincode: r.bPin }, reason),
    });
  }
  return pairs.slice(0, 50);
}

// ─── Merge ───────────────────────────────────────────────────────────────────

/**
 * Moves everything that belongs to `fromId` onto `toId`. Each module that links
 * records to a customer adds its reassignment here, so a merge never leaves
 * history pointing at the folded customer.
 */
async function reassignCustomerReferences(tx: Tx, fromId: string, toId: string) {
  // Negotiated prices: the kept customer's own agreements win; the duplicate's fill the gaps.
  const [fromPrices, toPrices] = await Promise.all([
    tx.customerPrice.findMany({ where: { customerId: fromId }, select: { variantId: true } }),
    tx.customerPrice.findMany({ where: { customerId: toId }, select: { variantId: true } }),
  ]);
  const kept = new Set(toPrices.map((p) => p.variantId));
  const movable = fromPrices.filter((p) => !kept.has(p.variantId)).map((p) => p.variantId);
  await tx.customerPrice.updateMany({ where: { customerId: fromId, variantId: { in: movable } }, data: { customerId: toId } });
  const dropped = await tx.customerPrice.deleteMany({ where: { customerId: fromId } });
  const orders = await tx.salesOrder.updateMany({ where: { customerId: fromId }, data: { customerId: toId } });
  // Payments and credit are append-only except for this re-link (enforced by trigger).
  const payments = await tx.payment.updateMany({ where: { customerId: fromId }, data: { customerId: toId } });
  const credit = await tx.customerCreditEntry.updateMany({ where: { customerId: fromId }, data: { customerId: toId } });

  return {
    pricesMoved: movable.length,
    pricesDropped: dropped.count,
    ordersMoved: orders.count,
    paymentsMoved: payments.count,
    creditEntriesMoved: credit.count,
  };
}

export async function mergeCustomer(sourceId: string, input: MergeCustomerInput, ctx: RequestContext) {
  if (sourceId === input.intoId) throw new ApiError(400, "MERGE_SAME", "Choose a different customer to keep");

  await withTransaction(async (tx) => {
    // Both rows are locked in a fixed order so two merges touching the same customers can't interleave.
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id IN (${Prisma.join([sourceId, input.intoId].sort())}) ORDER BY id FOR UPDATE`;
    const [source, target] = await Promise.all([
      tx.customer.findUnique({ where: { id: sourceId } }),
      tx.customer.findUnique({ where: { id: input.intoId }, include: { mergedInto: { select: { code: true } } } }),
    ]);
    if (!source) throw notFound("Customer");
    if (!target) throw new ApiError(400, "INVALID_CUSTOMER", "The customer to keep doesn't exist");
    if (source.mergedIntoId) throw new ApiError(409, "ALREADY_MERGED", `${source.code} was already merged`);
    if (target.mergedIntoId) {
      throw new ApiError(
        409,
        "TARGET_MERGED",
        `${target.code} was itself merged into ${target.mergedInto?.code}; keep that customer instead`,
      );
    }

    const moved = await reassignCustomerReferences(tx, source.id, target.id);

    // The mobile is unique, so it's released from the duplicate before the kept customer can take it.
    await tx.customer.update({
      where: { id: source.id },
      data: { mobile: null, isActive: false, mergedIntoId: target.id, mergedAt: new Date() },
    });
    const notes = source.notes ? [target.notes, `Merged from ${source.code}: ${source.notes}`].filter(Boolean).join("\n") : target.notes;
    const after = await tx.customer.update({
      where: { id: target.id },
      data: {
        mobile: target.mobile ?? source.mobile,
        whatsapp: target.whatsapp ?? source.whatsapp,
        email: target.email ?? source.email,
        addressLine: target.addressLine ?? source.addressLine,
        city: target.city ?? source.city,
        stateCode: target.stateCode ?? source.stateCode,
        pincode: target.pincode ?? source.pincode,
        notes,
      },
    });

    const metadata = { reason: input.reason, from: source.code, into: target.code, ...moved };
    await recordAudit(tx, ctx, {
      action: "customer.merged",
      entity: "Customer",
      entityId: source.id,
      before: auditSnapshot(source),
      metadata,
    });
    await recordAudit(tx, ctx, {
      action: "customer.merged_in",
      entity: "Customer",
      entityId: target.id,
      before: auditSnapshot(target),
      after: auditSnapshot(after),
      metadata,
    });
  });
  return getCustomer(input.intoId);
}

// ─── Customer-specific prices ────────────────────────────────────────────────

async function assertPriceable(tx: Tx, customerId: string, variantId: string) {
  const [customer, variant] = await Promise.all([
    tx.customer.findUnique({ where: { id: customerId }, select: { mergedIntoId: true } }),
    tx.variant.findUnique({ where: { id: variantId }, select: { status: true } }),
  ]);
  if (!customer) throw notFound("Customer");
  if (customer.mergedIntoId) throw new ApiError(409, "CUSTOMER_MERGED", "This customer was merged into another");
  if (!variant) throw new ApiError(400, "INVALID_VARIANT", "That item doesn't exist");
  if (variant.status !== "ACTIVE") throw new ApiError(409, "VARIANT_INACTIVE", "Archived items can't get a customer price");
}

export async function setCustomerPrice(customerId: string, variantId: string, price: string, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    await assertPriceable(tx, customerId, variantId);
    const key = { customerId_variantId: { customerId, variantId } };
    const before = await tx.customerPrice.findUnique({ where: key });
    await tx.customerPrice.upsert({ where: key, create: { customerId, variantId, price: dec(price) }, update: { price: dec(price) } });
    await recordAudit(tx, ctx, {
      action: "customer.price_set",
      entity: "Customer",
      entityId: customerId,
      before: before ? { variantId, price: before.price } : undefined,
      after: { variantId, price },
    });
  });
  return getCustomer(customerId);
}

export async function removeCustomerPrice(customerId: string, variantId: string, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    const key = { customerId_variantId: { customerId, variantId } };
    const before = await tx.customerPrice.findUnique({ where: key });
    if (!before) throw notFound("Customer price");
    await tx.customerPrice.delete({ where: key });
    await recordAudit(tx, ctx, {
      action: "customer.price_removed",
      entity: "Customer",
      entityId: customerId,
      before: { variantId, price: before.price },
    });
  });
  return getCustomer(customerId);
}
