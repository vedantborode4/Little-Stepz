import { prisma, Prisma } from "@repo/crm-db/client";
import type {
  LedgerQuery,
  LedgerRowDto,
  StockDocumentDto,
  StockReconciliationDto,
  StockRowDto,
  StockListQuery,
  StockState,
  StockSummaryDto,
  VariantStockCardDto,
} from "@repo/crm-schema";
import { fromDbDate, toDbDate } from "../../core/dates";
import { ApiError, notFound } from "../../core/http";
import { buildOrderBy, pageWindow, paginated } from "../../core/list";
import { Decimal, money, moneyOrNull } from "../../core/money";

/** Whether the caller may see costs; cost fields are left out entirely when not. */
export interface Visibility {
  costs: boolean;
}

/** Columns of the `stated` CTE (the outer query can't see the inner table aliases). */
const STOCK_SORTS: Record<string, Prisma.Sql> = {
  product: Prisma.sql`"productName", position`,
  sku: Prisma.sql`sku`,
  physical: Prisma.sql`physical`,
  available: Prisma.sql`available`,
};

interface StockSqlRow {
  variantId: string;
  sku: string;
  variantName: string;
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string;
  imageUrl: string | null;
  reorderLevel: number;
  sellable: number;
  damaged: number;
  demo: number;
  quarantine: number;
  physical: number;
  available: number;
  state: StockState;
}

/**
 * Stock per variant in one SQL pass, so state filters (low / out) and sorting
 * by quantity happen in the database and paginate correctly. Reservations are
 * added by the sales module; until then available = sellable.
 */
function stockSql(query: Pick<StockListQuery, "categoryId" | "locationId" | "state" | "q" | "includeEmpty">, variantId?: string) {
  const locationFilter = query.locationId ? Prisma.sql`WHERE "locationId" = ${query.locationId}` : Prisma.empty;
  // A single-variant lookup (the stock card) shows archived items too; lists hide them unless they still hold stock.
  const conditions: Prisma.Sql[] = variantId
    ? [Prisma.sql`v.id = ${variantId}`]
    : [Prisma.sql`p.status <> 'ARCHIVED'`, Prisma.sql`(v.status = 'ACTIVE' OR COALESCE(b.physical, 0) > 0)`];
  if (query.categoryId) conditions.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
  if (query.q) {
    const like = `%${query.q}%`;
    conditions.push(Prisma.sql`(p.name ILIKE ${like} OR v.sku ILIKE ${like} OR p.code ILIKE ${like} OR v.name ILIKE ${like})`);
  }
  if (!query.includeEmpty) conditions.push(Prisma.sql`COALESCE(b.physical, 0) > 0`);

  const base = Prisma.sql`
    WITH bal AS (
      SELECT "variantId",
        SUM(quantity) FILTER (WHERE bucket = 'SELLABLE')::int AS sellable,
        SUM(quantity) FILTER (WHERE bucket = 'DAMAGED')::int AS damaged,
        SUM(quantity) FILTER (WHERE bucket = 'DEMO')::int AS demo,
        SUM(quantity) FILTER (WHERE bucket = 'QUARANTINE')::int AS quarantine,
        SUM(quantity)::int AS physical
      FROM "StockBalance" ${locationFilter}
      GROUP BY "variantId"
    ),
    rows AS (
      SELECT v.id AS "variantId", v.sku, v.name AS "variantName", v.position, v."reorderLevel",
        p.id AS "productId", p.code AS "productCode", p.name AS "productName", p."imageUrl", c.name AS "categoryName",
        COALESCE(b.sellable, 0) AS sellable, COALESCE(b.damaged, 0) AS damaged, COALESCE(b.demo, 0) AS demo,
        COALESCE(b.quarantine, 0) AS quarantine, COALESCE(b.physical, 0) AS physical,
        COALESCE(b.sellable, 0) AS available
      FROM "Variant" v
      JOIN "Product" p ON p.id = v."productId"
      JOIN "Category" c ON c.id = p."categoryId"
      LEFT JOIN bal b ON b."variantId" = v.id
      WHERE ${Prisma.join(conditions, " AND ")}
    ),
    stated AS (
      SELECT rows.*, CASE
        WHEN available <= 0 THEN 'OUT'
        WHEN "reorderLevel" > 0 AND available <= "reorderLevel" THEN 'LOW'
        ELSE 'OK' END AS state
      FROM rows
    )`;
  const stateFilter = query.state ? Prisma.sql`WHERE state = ${query.state}` : Prisma.empty;
  return { base, stateFilter };
}

async function attachLocationsAndCosts(rows: StockSqlRow[], visibility: Visibility, locationId?: string): Promise<StockRowDto[]> {
  const ids = rows.map((r) => r.variantId);
  const [balances, costs] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { variantId: { in: ids }, locationId, quantity: { gt: 0 } },
      include: { location: { select: { code: true, name: true } } },
    }),
    visibility.costs ? prisma.variantCost.findMany({ where: { variantId: { in: ids } } }) : Promise.resolve([]),
  ]);
  const costById = new Map(costs.map((c) => [c.variantId, c]));

  return rows.map((r) => {
    const byLocation = new Map<string, StockRowDto["byLocation"][number]>();
    for (const b of balances.filter((x) => x.variantId === r.variantId)) {
      const entry = byLocation.get(b.locationId) ?? {
        locationId: b.locationId,
        locationCode: b.location.code,
        locationName: b.location.name,
        sellable: 0,
        damaged: 0,
        demo: 0,
        quarantine: 0,
      };
      entry[b.bucket.toLowerCase() as "sellable" | "damaged" | "demo" | "quarantine"] += b.quantity;
      byLocation.set(b.locationId, entry);
    }

    const dto: StockRowDto = {
      ...r,
      reserved: 0,
      byLocation: [...byLocation.values()].sort((a, b) => a.locationCode.localeCompare(b.locationCode)),
    };
    if (visibility.costs) {
      const cost = costById.get(r.variantId);
      const avg = cost && cost.valuedQty > 0 ? new Decimal(cost.totalValue.toString()).div(cost.valuedQty) : null;
      dto.avgUnitCost = avg ? money(avg) : null;
      dto.stockValue = cost ? money(new Decimal(cost.totalValue.toString())) : null;
      dto.unvaluedQty = cost?.unvaluedQty ?? 0;
    }
    return dto;
  });
}

export async function listStock(query: StockListQuery, visibility: Visibility) {
  const { base, stateFilter } = stockSql(query);
  const [sortKey, direction] = (query.sort ?? "product:asc").split(":") as [string, "asc" | "desc"];
  const sort = STOCK_SORTS[sortKey];
  if (!sort) throw new ApiError(400, "INVALID_SORT", `Cannot sort by "${sortKey}"`);
  const { skip, take } = pageWindow(query);
  const dir = direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;

  const [rows, counted] = await Promise.all([
    prisma.$queryRaw<
      StockSqlRow[]
    >`${base} SELECT * FROM stated ${stateFilter} ORDER BY ${sort} ${dir}, "variantId" LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw<{ count: number }[]>`${base} SELECT COUNT(*)::int AS count FROM stated ${stateFilter}`,
  ]);
  return paginated(await attachLocationsAndCosts(rows, visibility, query.locationId), counted[0]?.count ?? 0, query);
}

export async function stockSummary(visibility: Visibility): Promise<StockSummaryDto> {
  const { base } = stockSql({ includeEmpty: true });
  const [totals] = await prisma.$queryRaw<
    { variants: number; physical: number; available: number; damaged: number; demo: number; low: number; out: number }[]
  >`${base}
    SELECT COUNT(*)::int AS variants, COALESCE(SUM(physical), 0)::int AS physical, COALESCE(SUM(available), 0)::int AS available,
      COALESCE(SUM(damaged), 0)::int AS damaged, COALESCE(SUM(demo), 0)::int AS demo,
      COUNT(*) FILTER (WHERE state = 'LOW')::int AS low, COUNT(*) FILTER (WHERE state = 'OUT')::int AS out
    FROM stated`;
  const summary: StockSummaryDto = {
    variants: totals!.variants,
    physical: totals!.physical,
    available: totals!.available,
    damaged: totals!.damaged,
    demo: totals!.demo,
    lowStock: totals!.low,
    outOfStock: totals!.out,
  };
  if (visibility.costs) {
    const value = await prisma.variantCost.aggregate({ _sum: { totalValue: true, unvaluedQty: true } });
    summary.stockValue = money(new Decimal((value._sum.totalValue ?? 0).toString()));
    summary.unvaluedQty = value._sum.unvaluedQty ?? 0;
  }
  return summary;
}

// ─── Ledger ──────────────────────────────────────────────────────────────────

const ledgerInclude = {
  document: { include: { createdBy: { select: { name: true } }, reversalOf: { select: { type: true } } } },
  variant: { select: { sku: true, name: true, product: { select: { name: true } } } },
  location: { select: { code: true } },
} satisfies Prisma.StockMovementInclude;

type LedgerRow = Prisma.StockMovementGetPayload<{ include: typeof ledgerInclude }>;

function toLedgerRow(m: LedgerRow, visibility: Visibility): LedgerRowDto {
  const row: LedgerRowDto = {
    id: m.id,
    documentId: m.documentId,
    documentCode: m.document.code,
    type: m.document.type,
    effectiveType: m.document.reversalOf?.type ?? m.document.type,
    businessDate: fromDbDate(m.document.businessDate),
    createdAt: m.createdAt.toISOString(),
    variantId: m.variantId,
    sku: m.variant.sku,
    productName: m.variant.product.name,
    variantName: m.variant.name,
    locationCode: m.location.code,
    bucket: m.bucket,
    quantity: m.quantity,
    reference: m.document.reference,
    reason: m.document.reason,
    reasonCode: m.document.reasonCode,
    createdByName: m.document.createdBy?.name ?? null,
  };
  if (visibility.costs) row.unitCost = moneyOrNull(m.unitCost);
  return row;
}

const LEDGER_SORTS = { createdAt: "createdAt", businessDate: "document.businessDate", sku: "variant.sku" };

export async function listLedger(query: LedgerQuery, visibility: Visibility) {
  const where: Prisma.StockMovementWhereInput = {
    variantId: query.variantId,
    locationId: query.locationId,
    variant: query.productId ? { productId: query.productId } : undefined,
    document: {
      type: query.type,
      businessDate:
        query.from || query.to
          ? { gte: query.from ? toDbDate(query.from) : undefined, lte: query.to ? toDbDate(query.to) : undefined }
          : undefined,
    },
    ...(query.q && {
      OR: [
        { variant: { sku: { contains: query.q, mode: "insensitive" } } },
        { variant: { product: { name: { contains: query.q, mode: "insensitive" } } } },
        { document: { code: { contains: query.q, mode: "insensitive" } } },
        { document: { reference: { contains: query.q, mode: "insensitive" } } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: ledgerInclude,
      orderBy: buildOrderBy(query.sort, LEDGER_SORTS, "createdAt:desc"),
      ...pageWindow(query),
    }),
    prisma.stockMovement.count({ where }),
  ]);
  return paginated(
    rows.map((r) => toLedgerRow(r, visibility)),
    total,
    query,
  );
}

export async function getStockDocument(id: string, visibility: Visibility): Promise<StockDocumentDto> {
  const doc = await prisma.stockDocument.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      reversalOf: { select: { id: true, code: true, type: true } },
      reversedBy: { select: { id: true, code: true } },
      lines: {
        include: {
          variant: { select: { sku: true, name: true, product: { select: { name: true } } } },
          location: { select: { code: true } },
        },
      },
    },
  });
  if (!doc) throw notFound("Stock document");
  return {
    id: doc.id,
    code: doc.code,
    type: doc.type,
    effectiveType: doc.reversalOf?.type ?? doc.type,
    businessDate: fromDbDate(doc.businessDate),
    reason: doc.reason,
    reasonCode: doc.reasonCode,
    reference: doc.reference,
    notes: doc.notes,
    sourceType: doc.sourceType,
    createdByName: doc.createdBy?.name ?? null,
    createdAt: doc.createdAt.toISOString(),
    reversalOf: doc.reversalOf && { id: doc.reversalOf.id, code: doc.reversalOf.code },
    reversedBy: doc.reversedBy,
    canReverse: doc.type !== "REVERSAL" && !doc.reversedBy && !doc.sourceType,
    lines: doc.lines.map((l) => ({
      variantId: l.variantId,
      sku: l.variant.sku,
      productName: l.variant.product.name,
      variantName: l.variant.name,
      locationCode: l.location.code,
      bucket: l.bucket,
      quantity: l.quantity,
      ...(visibility.costs && { unitCost: moneyOrNull(l.unitCost) }),
    })),
  };
}

// ─── Variant stock card ──────────────────────────────────────────────────────

/** Sums every movement by the document type it belongs to (a reversal counts against what it reverses). */
export async function reconcileVariant(variantId: string, actualPhysical: number): Promise<StockReconciliationDto> {
  const rows = await prisma.$queryRaw<{ type: string; qty: number }[]>`
    SELECT COALESCE(o.type, d.type)::text AS type, SUM(m.quantity)::int AS qty
    FROM "StockMovement" m
    JOIN "StockDocument" d ON d.id = m."documentId"
    LEFT JOIN "StockDocument" o ON o.id = d."reversalOfId"
    WHERE m."variantId" = ${variantId}
    GROUP BY 1`;
  const sum = (type: string) => rows.find((r) => r.type === type)?.qty ?? 0;

  const r = {
    opening: sum("OPENING"),
    purchases: sum("PURCHASE"),
    salesReturns: sum("SALE_RETURN"),
    sales: -sum("SALE"),
    purchaseReturns: -sum("PURCHASE_RETURN"),
    writeOffs: -sum("WRITE_OFF"),
    adjustments: sum("ADJUSTMENT"),
    internalNet: sum("TRANSFER") + sum("BUCKET_MOVE"),
  };
  return {
    ...r,
    computedPhysical: r.opening + r.purchases + r.salesReturns - r.sales - r.purchaseReturns - r.writeOffs + r.adjustments + r.internalNet,
    actualPhysical,
  };
}

export async function variantStockCard(variantId: string, visibility: Visibility): Promise<VariantStockCardDto> {
  const { base } = stockSql({ includeEmpty: true }, variantId);
  const rows = await prisma.$queryRaw<StockSqlRow[]>`${base} SELECT * FROM stated`;
  if (!rows.length) throw notFound("Variant");
  const [stock] = await attachLocationsAndCosts(rows, visibility);
  const [reconciliation, recent] = await Promise.all([
    reconcileVariant(variantId, stock!.physical),
    prisma.stockMovement.findMany({
      where: { variantId },
      include: ledgerInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 25,
    }),
  ]);
  return { stock: stock!, reconciliation, recent: recent.map((m) => toLedgerRow(m, visibility)) };
}
