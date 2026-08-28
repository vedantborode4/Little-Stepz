import { Decimal } from "decimal.js";

/**
 * Invoice maths and seller identity.
 *
 * Product prices are GST-inclusive, so tax is *back-computed* out of the amount
 * charged rather than added on top: taxable = total / (1 + rate), tax = the
 * remainder. Adding tax on top would change what the customer already paid.
 *
 * Everything about the seller comes from env so an accountant can correct the
 * GSTIN or the rate without a code change.
 */

export interface SellerDetails {
  name: string;
  gstin: string;
  pan: string;
  address: string;
  state: string;
  stateCode: string;
  email: string;
  phone: string;
  website: string;
}

export function getSeller(): SellerDetails {
  return {
    name: process.env.INVOICE_SELLER_NAME ?? "Little Stepz",
    gstin: process.env.INVOICE_GSTIN ?? "",
    pan: process.env.INVOICE_PAN ?? "",
    address:
      process.env.INVOICE_ADDRESS ??
      "H.No. 1-5-431/34/19/1, Laxmi Nagar, Old Alwal, Secunderabad, Medchal-Malkajgiri District, Hyderabad, Telangana - 500010",
    state: process.env.INVOICE_STATE ?? "Telangana",
    stateCode: process.env.INVOICE_STATE_CODE ?? "36",
    email: process.env.INVOICE_EMAIL ?? "support@littlestepz.in",
    phone: process.env.INVOICE_PHONE ?? "+91 99206 34567",
    website: process.env.INVOICE_WEBSITE ?? "littlestepz.in",
  };
}

/** Flat rate across the catalogue; overridable without a deploy. */
export function getGstRate(): Decimal {
  const raw = Number(process.env.INVOICE_GST_RATE ?? "18");
  return new Decimal(Number.isFinite(raw) && raw >= 0 ? raw : 18);
}

/**
 * Indian financial year (April–March) for a given instant, e.g. "2026-27".
 *
 * Computed in IST rather than the server's timezone: an order placed at 02:00 IST
 * on 1 April is UTC 20:30 on 31 March, and a UTC-based year would file it under
 * the previous FY — an off-by-one that only ever shows up at audit time.
 */
export function financialYearOf(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth(); // 0 = January
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function formatInvoiceNumber(financialYear: string, sequence: number): string {
  const prefix = process.env.INVOICE_NUMBER_PREFIX ?? "LS";
  return `${prefix}/${financialYear}/${String(sequence).padStart(5, "0")}`;
}

export interface TaxLine {
  name: string;
  variantName: string | null;
  quantity: number;
  /** GST-inclusive line total. */
  gross: Decimal;
  taxable: Decimal;
  tax: Decimal;
}

export interface TaxBreakup {
  gstRate: Decimal;
  isIntraState: boolean;
  taxableValue: Decimal;
  cgst: Decimal;
  sgst: Decimal;
  igst: Decimal;
  grandTotal: Decimal;
  lines: TaxLine[];
}

const round = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

/** Split an inclusive amount into taxable value and tax. */
function splitInclusive(gross: Decimal, rate: Decimal): { taxable: Decimal; tax: Decimal } {
  const divisor = new Decimal(1).plus(rate.div(100));
  const taxable = round(gross.div(divisor));
  return { taxable, tax: round(gross.minus(taxable)) };
}

export interface InvoiceInput {
  items: { name: string; variantName: string | null; quantity: number; lineTotal: Decimal }[];
  /** Charged shipping. Taxed at the same rate — it is part of the consideration. */
  shipping: Decimal;
  discount: Decimal;
  /** What the customer actually paid. The breakup is reconciled against this. */
  grandTotal: Decimal;
  buyerState: string | null;
}

/**
 * Build the tax breakup for one order.
 *
 * The line values are apportioned from the *order total*, not summed independently,
 * so the parts always add up to the amount charged. A discount spread across lines
 * would otherwise leave the invoice a rupee or two off, which is exactly the kind of
 * mismatch a GST return gets rejected for.
 */
export function computeTax(input: InvoiceInput): TaxBreakup {
  const rate = getGstRate();
  const seller = getSeller();

  const itemsGross = input.items.reduce((sum, i) => sum.plus(i.lineTotal), new Decimal(0));
  const chargeable = input.grandTotal;

  // Discounts and shipping are folded in proportionally so the lines reconcile.
  const scale = itemsGross.gt(0) ? chargeable.div(itemsGross) : new Decimal(0);

  const lines: TaxLine[] = [];
  let allocated = new Decimal(0);

  input.items.forEach((item, index) => {
    const isLast = index === input.items.length - 1;
    // The last line absorbs the rounding remainder, so the column sums exactly.
    const gross = isLast ? chargeable.minus(allocated) : round(item.lineTotal.mul(scale));
    allocated = allocated.plus(gross);
    const { taxable, tax } = splitInclusive(gross, rate);
    lines.push({
      name: item.name,
      variantName: item.variantName,
      quantity: item.quantity,
      gross,
      taxable,
      tax,
    });
  });

  const { taxable: taxableValue, tax: totalTax } = splitInclusive(chargeable, rate);

  // Place of supply decides the split: same state as the seller means the tax is
  // shared between centre and state; anywhere else it is a single integrated tax.
  const isIntraState =
    !!input.buyerState &&
    input.buyerState.trim().toLowerCase() === seller.state.trim().toLowerCase();

  const half = round(totalTax.div(2));
  return {
    gstRate: rate,
    isIntraState,
    taxableValue,
    // The second half takes the remainder so cgst + sgst === totalTax exactly.
    cgst: isIntraState ? half : new Decimal(0),
    sgst: isIntraState ? totalTax.minus(half) : new Decimal(0),
    igst: isIntraState ? new Decimal(0) : totalTax,
    grandTotal: chargeable,
    lines,
  };
}
