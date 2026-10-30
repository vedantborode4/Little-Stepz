import { ApiError } from "../../core/http";
import { Decimal } from "../../core/money";

export interface SoldLine {
  sku: string;
  quantity: number;
  lineTotal: Decimal;
  taxableValue: Decimal;
  /** Cost of the units that left with a known cost (null if never deducted). */
  cogs: Decimal | null;
  unknownCostQty: number;
}

export interface ReturnedSoFar {
  quantity: number;
  amount: Decimal;
  taxableValue: Decimal;
  cogs: Decimal;
  /** Units already returned that had a known cost. */
  knownQty: number;
}

export interface ReturnLineAmounts {
  amount: Decimal;
  taxableValue: Decimal;
  gstAmount: Decimal;
  cogs: Decimal;
  knownQty: number;
  unknownCostQty: number;
}

const round2 = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
const round6 = (v: Decimal) => v.toDecimalPlaces(6, Decimal.ROUND_HALF_EVEN);

/**
 * The share of a sold line that `quantity` returned units are worth. Amounts are
 * proportional to the units, and returning the last units takes whatever is left,
 * so a line returned in several goes always reverses exactly what it was sold for.
 * Units with a known cost come back first, at the cost they left at.
 */
export function returnLineAmounts(sold: SoldLine, prior: ReturnedSoFar, quantity: number): ReturnLineAmounts {
  const remaining = sold.quantity - prior.quantity;
  if (quantity > remaining) {
    throw new ApiError(409, "OVER_RETURN", `Only ${remaining} of ${sold.sku} can still be returned`, { sku: sold.sku, remaining });
  }
  const last = quantity === remaining;
  const share = (total: Decimal, done: Decimal) => (last ? total.sub(done) : round2(total.mul(quantity).div(sold.quantity)));
  const amount = share(sold.lineTotal, prior.amount);
  const taxableValue = share(sold.taxableValue, prior.taxableValue);

  const knownTotal = sold.quantity - sold.unknownCostQty;
  const knownRemaining = knownTotal - prior.knownQty;
  const knownQty = Math.min(quantity, knownRemaining);
  const cogsTotal = sold.cogs ?? new Decimal(0);
  const cogs =
    knownQty === 0
      ? new Decimal(0)
      : knownQty === knownRemaining
        ? cogsTotal.sub(prior.cogs)
        : round6(cogsTotal.mul(knownQty).div(knownTotal));

  return { amount, taxableValue, gstAmount: amount.sub(taxableValue), cogs, knownQty, unknownCostQty: quantity - knownQty };
}

/** Shipping given back, split into taxable value and GST in the same proportion it was charged. */
export function shippingRefundAmounts(refund: Decimal, charged: Decimal, chargedTaxable: Decimal, alreadyRefunded: Decimal) {
  const left = charged.sub(alreadyRefunded);
  if (refund.gt(left)) {
    throw new ApiError(409, "OVER_REFUND_SHIPPING", `Only ${left.toFixed(2)} of shipping can still be refunded`, {
      fieldErrors: { shippingRefund: ["More than the shipping left to refund"] },
    });
  }
  if (refund.isZero() || charged.isZero()) return { amount: new Decimal(0), taxableValue: new Decimal(0) };
  return { amount: refund, taxableValue: round2(refund.mul(chargedTaxable).div(charged)) };
}

/** Money that must go back: whatever has been paid beyond the order's new value. */
export function refundDue(paid: Decimal, netValueAfter: Decimal): Decimal {
  return Decimal.max(paid.sub(netValueAfter), 0);
}
