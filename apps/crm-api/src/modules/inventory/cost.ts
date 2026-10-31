import { Decimal } from "../../core/money";

/**
 * Moving weighted-average costing, as pure functions.
 *
 * Units with an unknown cost (opening stock entered without one) are kept apart
 * in `unvaluedQty`: they never dilute the average and never receive an invented
 * value. They are treated as the oldest units and leave first, carrying an
 * unknown (null) cost into whatever consumed them.
 */
export interface CostState {
  valuedQty: number;
  totalValue: Decimal;
  unvaluedQty: number;
}

export interface CostedPart {
  quantity: number;
  unitCost: Decimal | null;
}

const SCALE = 6;

export function averageCost(state: CostState): Decimal | null {
  return state.valuedQty > 0 ? state.totalValue.div(state.valuedQty).toDecimalPlaces(SCALE) : null;
}

export function receive(state: CostState, quantity: number, unitCost: Decimal | null): CostState {
  if (unitCost === null) return { ...state, unvaluedQty: state.unvaluedQty + quantity };
  return {
    ...state,
    valuedQty: state.valuedQty + quantity,
    totalValue: state.totalValue.add(unitCost.mul(quantity)).toDecimalPlaces(SCALE),
  };
}

/** Takes units out: unknown-cost units first, then valued units at the current average. */
export function issue(state: CostState, quantity: number): { state: CostState; parts: CostedPart[] } {
  if (quantity > state.unvaluedQty + state.valuedQty) {
    throw new Error(`Cost state has ${state.unvaluedQty + state.valuedQty} units, cannot issue ${quantity}`);
  }
  const parts: CostedPart[] = [];
  const fromUnvalued = Math.min(quantity, state.unvaluedQty);
  if (fromUnvalued > 0) parts.push({ quantity: fromUnvalued, unitCost: null });

  const fromValued = quantity - fromUnvalued;
  let { valuedQty, totalValue } = state;
  if (fromValued > 0) {
    // Taking the last valued units removes the whole remaining value, so rounding never leaves residue.
    const value = fromValued === valuedQty ? totalValue : averageCost(state)!.mul(fromValued).toDecimalPlaces(SCALE);
    parts.push({ quantity: fromValued, unitCost: value.div(fromValued).toDecimalPlaces(SCALE) });
    valuedQty -= fromValued;
    totalValue = valuedQty === 0 ? new Decimal(0) : Decimal.max(totalValue.sub(value), 0);
  }
  return { state: { valuedQty, totalValue, unvaluedQty: state.unvaluedQty - fromUnvalued }, parts };
}

/** Undoes a receipt (reversal of an inbound line) at the cost it came in at. */
export function unreceive(state: CostState, quantity: number, unitCost: Decimal | null): CostState {
  if (unitCost === null) {
    const fromUnvalued = Math.min(quantity, state.unvaluedQty);
    const rest = quantity - fromUnvalued;
    return rest > 0
      ? issue({ ...state, unvaluedQty: state.unvaluedQty - fromUnvalued }, rest).state
      : { ...state, unvaluedQty: state.unvaluedQty - fromUnvalued };
  }
  const fromValued = Math.min(quantity, state.valuedQty);
  const valuedQty = state.valuedQty - fromValued;
  const totalValue =
    valuedQty === 0 ? new Decimal(0) : Decimal.max(state.totalValue.sub(unitCost.mul(fromValued)), 0).toDecimalPlaces(SCALE);
  const rest = quantity - fromValued;
  return { valuedQty, totalValue, unvaluedQty: state.unvaluedQty - rest };
}
