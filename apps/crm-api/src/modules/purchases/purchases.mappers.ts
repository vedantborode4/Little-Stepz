import type { Prisma } from "@repo/crm-db/client";
import type { LandedCostTotalsDto, PurchaseDetailDto, PurchaseListItemDto, PurchaseLineDto } from "@repo/crm-schema";
import { fromDbDate } from "../../core/dates";
import { dec, Decimal, money } from "../../core/money";
import { computeLandedCost, type LandedLineResult, type LandedTotals } from "./landed-cost";

export interface Visibility {
  costs: boolean;
}

export const purchaseDetailInclude = {
  supplier: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  receivedBy: { select: { name: true } },
  createdBy: { select: { name: true } },
  stockDocument: { select: { id: true, code: true } },
  lines: {
    orderBy: { position: "asc" },
    include: {
      variant: { select: { sku: true, name: true, product: { select: { name: true } } } },
      returnLines: { select: { quantity: true } },
    },
  },
  charges: true,
  costAdjustments: {
    orderBy: { createdAt: "asc" },
    include: { createdBy: { select: { name: true } }, lines: { include: { variant: { select: { sku: true } } } } },
  },
  returns: {
    orderBy: { createdAt: "asc" },
    include: {
      location: { select: { name: true } },
      createdBy: { select: { name: true } },
      lines: { include: { variant: { select: { sku: true, name: true, product: { select: { name: true } } } } } },
    },
  },
} satisfies Prisma.PurchaseShipmentInclude;

type DetailRow = Prisma.PurchaseShipmentGetPayload<{ include: typeof purchaseDetailInclude }>;
type ListRow = Prisma.PurchaseShipmentGetPayload<{
  include: {
    supplier: { select: { id: true; name: true } };
    location: { select: { name: true } };
    lines: { select: { quantity: true; unitPriceInr: true; allocatedCharges: true } };
  };
}>;

const d = (v: Prisma.Decimal | null) => (v === null ? null : dec(v.toString()));

const totalsDto = (t: LandedTotals): LandedCostTotalsDto => ({
  goodsForeign: money(t.goodsForeign),
  goodsInr: money(t.goodsInr),
  capitalisedCharges: money(t.capitalisedCharges),
  inputTaxCredit: money(t.inputTaxCredit),
  landedTotal: money(t.landedTotal),
  units: t.units,
});

const lineCostDto = (r: LandedLineResult) => ({
  unitPriceInr: money(r.unitPriceInr),
  allocatedCharges: money(r.allocatedCharges),
  landedUnitCost: money(r.landedUnitCost),
  landedTotal: money(r.landedTotal),
});

/**
 * A received purchase reports the figures frozen at receipt. A draft shows a
 * live preview from the same maths (or none, if it can't be allocated yet).
 */
function landedFigures(row: DetailRow): { lines: (LandedLineResult | null)[]; totals: LandedTotals | null } {
  const charges = row.charges.map((c) => ({ amountInr: dec(c.amountInr.toString()), isRecoverableTax: c.isRecoverableTax }));
  if (row.status === "RECEIVED") {
    const lines = row.lines.map((l) => {
      const unitPriceInr = d(l.unitPriceInr)!;
      const allocatedCharges = d(l.allocatedCharges)!;
      return {
        unitPriceInr,
        allocatedCharges,
        landedUnitCost: d(l.landedUnitCost)!,
        landedTotal: unitPriceInr.mul(l.quantity).add(allocatedCharges),
      };
    });
    const goodsInr = lines.reduce((a, l, i) => a.add(l.unitPriceInr.mul(row.lines[i]!.quantity)), new Decimal(0));
    const capitalised = lines.reduce((a, l) => a.add(l.allocatedCharges), new Decimal(0));
    return {
      lines,
      totals: {
        goodsForeign: row.lines.reduce((a, l) => a.add(dec(l.unitPrice.toString()).mul(l.quantity)), new Decimal(0)),
        goodsInr,
        capitalisedCharges: capitalised,
        inputTaxCredit: charges.filter((c) => c.isRecoverableTax).reduce((a, c) => a.add(c.amountInr), new Decimal(0)),
        landedTotal: goodsInr.add(capitalised),
        units: row.lines.reduce((a, l) => a + l.quantity, 0),
      },
    };
  }
  try {
    const preview = computeLandedCost({
      exchangeRate: dec(row.exchangeRate.toString()),
      method: row.allocationMethod,
      lines: row.lines.map((l) => ({
        quantity: l.quantity,
        unitPrice: dec(l.unitPrice.toString()),
        weightKg: d(l.weightKg),
        cbm: d(l.cbm),
      })),
      charges,
    });
    return preview;
  } catch {
    return { lines: row.lines.map(() => null), totals: null };
  }
}

export function toPurchaseDetailDto(row: DetailRow, visibility: Visibility): PurchaseDetailDto {
  const figures = visibility.costs ? landedFigures(row) : null;

  const lines: PurchaseLineDto[] = row.lines.map((l, i) => ({
    id: l.id,
    variantId: l.variantId,
    sku: l.variant.sku,
    productName: l.variant.product.name,
    variantName: l.variant.name,
    quantity: l.quantity,
    returnedQty: l.returnLines.reduce((a, r) => a + r.quantity, 0),
    weightKg: l.weightKg?.toString() ?? null,
    cbm: l.cbm?.toString() ?? null,
    ...(figures && { unitPrice: l.unitPrice.toString(), costs: figures.lines[i] ? lineCostDto(figures.lines[i]!) : null }),
  }));

  const dto: PurchaseDetailDto = {
    id: row.id,
    code: row.code,
    status: row.status,
    supplier: row.supplier,
    invoiceNumber: row.invoiceNumber,
    shipmentRef: row.shipmentRef,
    invoiceDate: fromDbDate(row.invoiceDate),
    currency: row.currency,
    allocationMethod: row.allocationMethod,
    location: row.location,
    notes: row.notes,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    receivedDate: row.receivedDate ? fromDbDate(row.receivedDate) : null,
    receivedByName: row.receivedBy?.name ?? null,
    createdByName: row.createdBy?.name ?? null,
    stockDocument: row.stockDocument,
    lines,
    returns: row.returns.map((r) => ({
      id: r.id,
      code: r.code,
      businessDate: fromDbDate(r.businessDate),
      reason: r.reason,
      locationName: r.location.name,
      stockDocumentId: r.stockDocumentId,
      createdByName: r.createdBy?.name ?? null,
      lines: r.lines.map((l) => ({
        sku: l.variant.sku,
        productName: l.variant.product.name,
        variantName: l.variant.name,
        quantity: l.quantity,
      })),
    })),
  };
  if (figures) {
    dto.exchangeRate = row.exchangeRate.toString();
    dto.totals = figures.totals ? totalsDto(figures.totals) : null;
    dto.charges = row.charges.map((c) => ({
      id: c.id,
      type: c.type,
      description: c.description,
      amount: money(dec(c.amount.toString())),
      currency: c.currency,
      amountInr: money(dec(c.amountInr.toString())),
      isRecoverableTax: c.isRecoverableTax,
    }));
    dto.costAdjustments = row.costAdjustments.map((a) => ({
      id: a.id,
      code: a.code,
      type: a.type,
      description: a.description,
      amountInr: money(dec(a.amountInr.toString())),
      isRecoverableTax: a.isRecoverableTax,
      allocationMethod: a.allocationMethod,
      businessDate: fromDbDate(a.businessDate),
      createdByName: a.createdBy?.name ?? null,
      createdAt: a.createdAt.toISOString(),
      lines: a.lines.map((l) => ({
        variantId: l.variantId,
        sku: l.variant.sku,
        allocated: money(dec(l.allocated.toString())),
        toInventory: money(dec(l.toInventory.toString())),
        toCostOfSales: money(dec(l.toCostOfSales.toString())),
      })),
    }));
  }
  return dto;
}

export function toPurchaseListItemDto(row: ListRow, visibility: Visibility): PurchaseListItemDto {
  const dto: PurchaseListItemDto = {
    id: row.id,
    code: row.code,
    status: row.status,
    supplier: row.supplier,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: fromDbDate(row.invoiceDate),
    currency: row.currency,
    locationName: row.location.name,
    lineCount: row.lines.length,
    units: row.lines.reduce((a, l) => a + l.quantity, 0),
    receivedAt: row.receivedAt?.toISOString() ?? null,
  };
  if (visibility.costs) {
    dto.landedTotal =
      row.status === "RECEIVED"
        ? money(
            row.lines.reduce(
              (a, l) => a.add(dec((l.unitPriceInr ?? 0).toString()).mul(l.quantity)).add(dec((l.allocatedCharges ?? 0).toString())),
              new Decimal(0),
            ),
          )
        : null;
  }
  return dto;
}
