import { describe, expect, it } from "vitest";
import { Decimal } from "../src/core/money";
import { averageCost, issue, receive, unreceive, type CostState } from "../src/modules/inventory/cost";

const empty: CostState = { valuedQty: 0, totalValue: new Decimal(0), unvaluedQty: 0 };
const d = (v: string | number) => new Decimal(v);

describe("weighted average cost", () => {
  it("averages batches bought at different costs", () => {
    const s = receive(receive(empty, 10, d(12500)), 10, d(13500));
    expect(averageCost(s)!.toString()).toBe("13000");
  });

  it("issues at the average and removes all remaining value with the last unit", () => {
    let s = receive(empty, 3, d(10));
    s = receive(s, 1, d(11)); // avg 10.25
    const first = issue(s, 3);
    expect(first.parts).toEqual([{ quantity: 3, unitCost: d("10.25") }]);
    const last = issue(first.state, 1);
    expect(last.state.totalValue.toString()).toBe("0");
    expect(last.parts[0]!.unitCost!.toString()).toBe("10.25");
  });

  it("never invents a cost: unknown-cost units are tracked apart and leave first", () => {
    let s = receive(empty, 5, null);
    s = receive(s, 5, d(100));
    expect(averageCost(s)!.toString()).toBe("100");

    const out = issue(s, 7);
    expect(out.parts).toEqual([
      { quantity: 5, unitCost: null },
      { quantity: 2, unitCost: d(100) },
    ]);
    expect(out.state).toMatchObject({ unvaluedQty: 0, valuedQty: 3 });
    expect(out.state.totalValue.toString()).toBe("300");
  });

  it("has no average when every unit's cost is unknown", () => {
    expect(averageCost(receive(empty, 4, null))).toBeNull();
  });

  it("reverses a receipt at the cost it came in at", () => {
    let s = receive(empty, 10, d(100));
    s = receive(s, 10, d(200));
    s = unreceive(s, 10, d(200));
    expect(s.valuedQty).toBe(10);
    expect(averageCost(s)!.toString()).toBe("100");
  });

  it("refuses to issue more than it holds", () => {
    expect(() => issue(receive(empty, 2, d(5)), 3)).toThrow();
  });
});
