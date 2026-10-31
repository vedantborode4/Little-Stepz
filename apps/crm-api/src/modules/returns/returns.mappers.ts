import type { Prisma } from "@repo/crm-db/client";
import type { ReturnLineDto, SalesReturnDto, SalesReturnListItemDto } from "@repo/crm-schema";
import { fromDbDate } from "../../core/dates";
import { money } from "../../core/money";

export const returnListInclude = {
  order: { select: { id: true, code: true, customer: { select: { id: true, code: true, name: true } } } },
  lines: { select: { quantity: true } },
} satisfies Prisma.SalesReturnInclude;

export const returnDetailInclude = {
  order: { select: { id: true, code: true, customer: { select: { id: true, code: true, name: true } } } },
  location: { select: { name: true } },
  createdBy: { select: { name: true } },
  payment: { select: { id: true, code: true, account: { select: { name: true } } } },
  stockDocument: { select: { id: true, code: true } },
  lines: { include: { variant: { select: { sku: true, name: true, product: { select: { name: true } } } } } },
} satisfies Prisma.SalesReturnInclude;

type ListShape = {
  id: string;
  code: string;
  businessDate: Date;
  reason: string;
  amount: Prisma.Decimal;
  refundMethod: SalesReturnListItemDto["refundMethod"];
  refundAmount: Prisma.Decimal;
  createdAt: Date;
  order: { id: string; code: string; customer: { id: string; code: string; name: string } | null };
  lines: { quantity: number }[];
};

export const toReturnListItemDto = (r: ListShape): SalesReturnListItemDto => ({
  id: r.id,
  code: r.code,
  orderId: r.order.id,
  orderCode: r.order.code,
  customer: r.order.customer,
  businessDate: fromDbDate(r.businessDate),
  reason: r.reason,
  units: r.lines.reduce((s, l) => s + l.quantity, 0),
  amount: money(r.amount),
  refundMethod: r.refundMethod,
  refundAmount: money(r.refundAmount),
  createdAt: r.createdAt.toISOString(),
});

type DetailRow = Prisma.SalesReturnGetPayload<{ include: typeof returnDetailInclude }>;

export function toReturnDto(r: DetailRow, costs: boolean): SalesReturnDto {
  return {
    ...toReturnListItemDto(r),
    locationName: r.location.name,
    taxableValue: money(r.taxableValue),
    gstAmount: money(r.gstAmount),
    shippingRefund: money(r.shippingRefund),
    refundPayment: r.payment ? { id: r.payment.id, code: r.payment.code, accountName: r.payment.account.name } : null,
    stockDocument: r.stockDocument,
    createdByName: r.createdBy?.name ?? null,
    lines: r.lines.map(
      (l): ReturnLineDto => ({
        orderLineId: l.orderLineId,
        variantId: l.variantId,
        sku: l.variant.sku,
        productName: l.variant.product.name,
        variantName: l.variant.name,
        quantity: l.quantity,
        condition: l.condition,
        amount: money(l.amount),
        taxableValue: money(l.taxableValue),
        gstAmount: money(l.gstAmount),
        ...(costs && { cogs: money(l.cogs), unknownCostQty: l.unknownCostQty }),
      }),
    ),
  };
}
