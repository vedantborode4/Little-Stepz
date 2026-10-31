import type { AllocationMethod } from "@repo/crm-db/client";
import { ApiError } from "../../core/http";
import { Decimal } from "../../core/money";

/**
 * Landed cost as pure functions:
 *   landed unit cost = unit price × exchange rate + (allocated capitalised charges ÷ quantity)
 * Recoverable input tax (GST / IGST) is never capitalised; it is reported as
 * input tax credit instead.
 */

const SCALE = 6;

export interface LandedLine {
  quantity: number;
  unitPrice: Decimal;
  weightKg: Decimal | null;
  cbm: Decimal | null;
}

export interface LandedCharge {
  amountInr: Decimal;
  isRecoverableTax: boolean;
}

export interface LandedLineResult {
  unitPriceInr: Decimal;
  allocatedCharges: Decimal;
  landedUnitCost: Decimal;
  landedTotal: Decimal;
}

export interface LandedTotals {
  goodsForeign: Decimal;
  goodsInr: Decimal;
  capitalisedCharges: Decimal;
  inputTaxCredit: Decimal;
  landedTotal: Decimal;
  units: number;
}

export function chargeToInr(amount: Decimal, chargeCurrency: string, exchangeRate: Decimal) {
  return chargeCurrency === "INR" ? amount : amount.mul(exchangeRate).toDecimalPlaces(2);
}

/** The base each line is weighted by for the chosen method. */
export function allocationWeights(method: AllocationMethod, lines: LandedLine[], exchangeRate: Decimal): Decimal[] {
  return lines.map((l) => {
    switch (method) {
      case "VALUE":
        return l.unitPrice.mul(exchangeRate).mul(l.quantity);
      case "QUANTITY":
        return new Decimal(l.quantity);
      case "WEIGHT":
        return (l.weightKg ?? new Decimal(0)).mul(l.quantity);
      case "VOLUME":
        return (l.cbm ?? new Decimal(0)).mul(l.quantity);
    }
  });
}

/**
 * Splits `total` in proportion to `weights`. The last weighted line takes the
 * remainder, so the parts always add up to exactly `total`.
 */
export function allocate(total: Decimal, weights: Decimal[]): Decimal[] {
  const sum = weights.reduce((a, b) => a.add(b), new Decimal(0));
  if (total.isZero()) return weights.map(() => new Decimal(0));
  if (sum.isZero())
    throw new ApiError(400, "CANNOT_ALLOCATE", "Charges can't be split: every line has a zero share. Choose another split method.");

  const lastWeighted = weights.reduce((last, w, i) => (w.gt(0) ? i : last), -1);
  let assigned = new Decimal(0);
  return weights.map((w, i) => {
    if (i === lastWeighted) return total.sub(assigned);
    const part = total.mul(w).div(sum).toDecimalPlaces(SCALE);
    assigned = assigned.add(part);
    return part;
  });
}

export function computeLandedCost(input: {
  exchangeRate: Decimal;
  method: AllocationMethod;
  lines: LandedLine[];
  charges: LandedCharge[];
}): { lines: LandedLineResult[]; totals: LandedTotals } {
  const capitalised = input.charges.filter((c) => !c.isRecoverableTax).reduce((a, c) => a.add(c.amountInr), new Decimal(0));
  const inputTaxCredit = input.charges.filter((c) => c.isRecoverableTax).reduce((a, c) => a.add(c.amountInr), new Decimal(0));
  const shares = allocate(capitalised, allocationWeights(input.method, input.lines, input.exchangeRate));

  const lines = input.lines.map((l, i) => {
    const unitPriceInr = l.unitPrice.mul(input.exchangeRate).toDecimalPlaces(SCALE);
    const allocatedCharges = shares[i]!;
    const landedUnitCost = unitPriceInr.add(allocatedCharges.div(l.quantity)).toDecimalPlaces(SCALE);
    return { unitPriceInr, allocatedCharges, landedUnitCost, landedTotal: unitPriceInr.mul(l.quantity).add(allocatedCharges) };
  });

  const goodsInr = lines.reduce((a, l, i) => a.add(l.unitPriceInr.mul(input.lines[i]!.quantity)), new Decimal(0));
  return {
    lines,
    totals: {
      goodsForeign: input.lines.reduce((a, l) => a.add(l.unitPrice.mul(l.quantity)), new Decimal(0)),
      goodsInr,
      capitalisedCharges: capitalised,
      inputTaxCredit,
      landedTotal: goodsInr.add(capitalised),
      units: input.lines.reduce((a, l) => a + l.quantity, 0),
    },
  };
}
