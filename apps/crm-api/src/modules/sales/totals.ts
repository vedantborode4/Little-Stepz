import { Decimal, round2 } from "../../core/money";
import { ApiError } from "../../core/http";

export interface PricedLine {
  quantity: number;
  unitPrice: Decimal;
  lineDiscount: Decimal;
  gstRate: Decimal;
}

export interface LineAmounts {
  gross: Decimal;
  orderDiscountShare: Decimal;
  lineTotal: Decimal;
  taxableValue: Decimal;
  gstAmount: Decimal;
}

export interface SaleTotals {
  units: number;
  subtotal: Decimal;
  lineDiscounts: Decimal;
  orderDiscount: Decimal;
  shippingCharged: Decimal;
  grandTotal: Decimal;
  taxableTotal: Decimal;
  gstTotal: Decimal;
}

/** Prices include GST: the taxable value is backed out and GST is the remainder, so the two always add up to the price. */
export function backOutGst(inclusive: Decimal, rate: Decimal): { taxable: Decimal; gst: Decimal } {
  const taxable = round2(inclusive.div(rate.div(100).add(1)));
  return { taxable, gst: inclusive.sub(taxable) };
}

/**
 * Line and order amounts for a cart. The order discount is split across lines in
 * proportion to their value after line discounts, with the last line taking the
 * rounding remainder, so line totals always add up to the order total. Shipping
 * charged follows the highest GST rate on the order (it's part of the supply).
 */
export function computeSaleTotals(
  lines: PricedLine[],
  orderDiscount: Decimal,
  shippingCharged: Decimal,
): { lines: LineAmounts[]; totals: SaleTotals } {
  const nets = lines.map((l, i) => {
    const gross = l.unitPrice.mul(l.quantity);
    if (l.lineDiscount.gt(gross)) {
      throw new ApiError(400, "DISCOUNT_TOO_HIGH", "A line discount can't exceed the line value", {
        fieldErrors: { [`lines.${i}.lineDiscount`]: ["More than the line value"] },
      });
    }
    return { gross, net: gross.sub(l.lineDiscount) };
  });
  const netTotal = nets.reduce((s, n) => s.add(n.net), new Decimal(0));
  if (orderDiscount.gt(netTotal)) {
    throw new ApiError(400, "DISCOUNT_TOO_HIGH", "The order discount can't exceed the order value", {
      fieldErrors: { orderDiscount: ["More than the order value"] },
    });
  }

  let remaining = orderDiscount;
  const amounts = lines.map((l, i): LineAmounts => {
    const { gross, net } = nets[i]!;
    const isLast = i === lines.length - 1;
    const share = netTotal.isZero() ? new Decimal(0) : isLast ? remaining : round2(orderDiscount.mul(net).div(netTotal));
    remaining = remaining.sub(share);
    const lineTotal = net.sub(share);
    const { taxable, gst } = backOutGst(lineTotal, l.gstRate);
    return { gross, orderDiscountShare: share, lineTotal, taxableValue: taxable, gstAmount: gst };
  });

  const maxRate = lines.reduce((m, l) => Decimal.max(m, l.gstRate), new Decimal(0));
  const shipping = backOutGst(shippingCharged, maxRate);
  const sum = (pick: (a: LineAmounts) => Decimal) => amounts.reduce((s, a) => s.add(pick(a)), new Decimal(0));

  return {
    lines: amounts,
    totals: {
      units: lines.reduce((s, l) => s + l.quantity, 0),
      subtotal: sum((a) => a.gross),
      lineDiscounts: lines.reduce((s, l) => s.add(l.lineDiscount), new Decimal(0)),
      orderDiscount,
      shippingCharged,
      grandTotal: sum((a) => a.lineTotal).add(shippingCharged),
      taxableTotal: sum((a) => a.taxableValue).add(shipping.taxable),
      gstTotal: sum((a) => a.gstAmount).add(shipping.gst),
    },
  };
}
