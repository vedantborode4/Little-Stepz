import { describe, expect, it } from "vitest";
import { Decimal } from "../src/core/money";
import { allocate, chargeToInr, computeLandedCost } from "../src/modules/purchases/landed-cost";

const d = (v: string | number) => new Decimal(v);
const line = (quantity: number, unitPrice: string | number, weightKg?: number) => ({
  quantity,
  unitPrice: d(unitPrice),
  weightKg: weightKg ? d(weightKg) : null,
  cbm: null,
});

describe("landed cost", () => {
  it("Scenario A: 10 MJX cars land at ₹12,500 each; recoverable IGST stays out of cost", () => {
    const result = computeLandedCost({
      exchangeRate: d(12),
      method: "VALUE",
      lines: [line(10, 900)],
      charges: [
        { amountInr: d(8000), isRecoverableTax: false },
        { amountInr: d(9000), isRecoverableTax: false },
        { amountInr: d(22860), isRecoverableTax: true },
      ],
    });
    expect(result.lines[0]!.unitPriceInr.toString()).toBe("10800");
    expect(result.lines[0]!.landedUnitCost.toString()).toBe("12500");
    expect(result.totals.landedTotal.toString()).toBe("125000");
    expect(result.totals.inputTaxCredit.toString()).toBe("22860");
    expect(result.totals.capitalisedCharges.toString()).toBe("17000");
  });

  it("splits shared charges by purchase value so expensive items carry more", () => {
    const result = computeLandedCost({
      exchangeRate: d(1),
      method: "VALUE",
      lines: [line(100, 200), line(2, 15000)],
      charges: [{ amountInr: d(5000), isRecoverableTax: false }],
    });
    // goods: 20,000 vs 30,000 → 40% / 60%
    expect(result.lines.map((l) => l.allocatedCharges.toString())).toEqual(["2000", "3000"]);
    expect(result.lines[1]!.landedUnitCost.toString()).toBe("16500");
  });

  it("can split by quantity or weight instead", () => {
    const byQty = computeLandedCost({
      exchangeRate: d(1),
      method: "QUANTITY",
      lines: [line(3, 10), line(1, 1000)],
      charges: [{ amountInr: d(400), isRecoverableTax: false }],
    });
    expect(byQty.lines.map((l) => l.allocatedCharges.toString())).toEqual(["300", "100"]);

    const byWeight = computeLandedCost({
      exchangeRate: d(1),
      method: "WEIGHT",
      lines: [line(1, 10, 3), line(1, 10, 1)],
      charges: [{ amountInr: d(400), isRecoverableTax: false }],
    });
    expect(byWeight.lines.map((l) => l.allocatedCharges.toString())).toEqual(["300", "100"]);
  });

  it("always allocates exactly the charge total, even with repeating fractions", () => {
    const parts = allocate(d(100), [d(1), d(1), d(1)]);
    expect(parts.reduce((a, p) => a.add(p), d(0)).toString()).toBe("100");
  });

  it("converts foreign-currency charges at the purchase's own rate", () => {
    expect(chargeToInr(d(500), "CNY", d("11.85")).toString()).toBe("5925");
    expect(chargeToInr(d(500), "INR", d("11.85")).toString()).toBe("500");
  });
});
