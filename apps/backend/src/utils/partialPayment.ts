import { Decimal } from "decimal.js";

/**
 * Partial payment: a deposit taken online at checkout, the balance collected later.
 *
 * This module is the ONLY place the split is computed. Every other reader — the checkout
 * quote, the Razorpay charge, the courier manifest, refunds, reporting — uses the frozen
 * `Order.depositAmount` / `Order.balanceAmount` written at creation, because the configured
 * percentage can change while orders are live and a live order's obligation must not move
 * under it.
 */

/** Razorpay refuses any charge or refund below ₹1. */
const RAZORPAY_MIN = new Decimal(1);

/** Global kill switch, mirroring AUTO_SHIP_ENABLED. Off until the feature is verified. */
export function isPartialPaymentEnabled(): boolean {
  return (process.env.PARTIAL_PAYMENT_ENABLED ?? "false").toLowerCase() === "true";
}

/** Store-wide default deposit percentage; per-product/variant values override it. */
export function defaultDepositPercent(): Decimal {
  const raw = Number(process.env.PARTIAL_PAYMENT_PERCENT ?? "20");
  return Number.isFinite(raw) && raw > 0 && raw < 100 ? new Decimal(raw) : new Decimal(20);
}

/** Order value above which partial payment is withheld — successor to COD_MAX_AMOUNT. */
export function maxPartialOrderValue(): Decimal {
  const raw = Number(process.env.PARTIAL_MAX_ORDER_VALUE ?? "10000");
  return Number.isFinite(raw) && raw > 0 ? new Decimal(raw) : new Decimal(10000);
}

/** How many orders one customer may hold with an unpaid balance at once. */
export function maxOpenPartialOrders(): number {
  const raw = Number(process.env.PARTIAL_MAX_OPEN_ORDERS ?? "3");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 3;
}

// ── Terms resolution ────────────────────────────────────────────────────────────

export interface PartialProductTerms {
  partialPaymentEnabled: boolean;
  depositPercent: unknown;
}

export interface PartialVariantTerms {
  partialPaymentEnabled: boolean;
  depositPercent: unknown;
}

export interface ResolvedPartialTerms {
  enabled: boolean;
  depositPercent: Decimal;
}

/**
 * Resolve one cart line's terms, following the pre-order rule exactly: the product switch
 * is the master and a variant can only opt OUT, so there is one obvious place to disable
 * the feature for a product and every existing variant (defaulting to `true`) inherits.
 *
 * The percentage follows the same rule as `price`: a variant value overrides, null inherits
 * the product's, and a null product value inherits the store default.
 */
export function resolvePartialTerms(
  product: PartialProductTerms,
  variant?: PartialVariantTerms | null
): ResolvedPartialTerms {
  const enabled =
    product.partialPaymentEnabled && (variant ? variant.partialPaymentEnabled : true);

  const raw = variant?.depositPercent ?? product.depositPercent;
  const depositPercent = raw == null ? defaultDepositPercent() : new Decimal(raw.toString());

  return { enabled, depositPercent };
}

/**
 * Resolve the whole cart. The order is a single payment, so partial payment is only on
 * offer when EVERY line allows it — you cannot part-deposit one item and prepay another.
 *
 * Where lines disagree on the percentage the highest wins: taking the largest deposit any
 * line asks for is the conservative reading, and it can never charge less than a product's
 * configured terms demand.
 */
export function resolveCartPartialTerms(
  lines: Array<{ product: PartialProductTerms; variant?: PartialVariantTerms | null }>
): ResolvedPartialTerms {
  if (lines.length === 0) return { enabled: false, depositPercent: defaultDepositPercent() };

  let enabled = true;
  let percent = new Decimal(0);

  for (const line of lines) {
    const terms = resolvePartialTerms(line.product, line.variant);
    if (!terms.enabled) enabled = false;
    if (terms.depositPercent.gt(percent)) percent = terms.depositPercent;
  }

  return {
    enabled,
    depositPercent: percent.gt(0) ? percent : defaultDepositPercent(),
  };
}

// ── The split ───────────────────────────────────────────────────────────────────

export interface DepositSplit {
  deposit: Decimal;
  balance: Decimal;
}

/**
 * Split an order total into the deposit charged now and the balance collected later.
 *
 * The balance is rounded to WHOLE RUPEES and the deposit absorbs every paisa. Two reasons,
 * both load-bearing:
 *
 *  1. A courier collects the balance as physical cash and cannot make paise, and the
 *     remittance statement must reconcile to the rupee.
 *  2. It keeps the paise identity at the gateway boundary. Razorpay amounts are
 *     `Math.round(x * 100)`, and the webhook amount checks compare against exactly that.
 *     With an integer balance, `round(deposit*100) + round(balance*100) === round(total*100)`
 *     always holds; with two independently-rounded halves you can construct totals where
 *     they disagree by a paisa and a legitimate capture throws AMOUNT_MISMATCH.
 *
 * The deposit is therefore a SUBTRACTION, never a second rounding, which makes
 * `deposit + balance === total` an identity rather than something we hope for. The database
 * re-asserts it with the `order_partial_split_sums` CHECK constraint.
 *
 * Side effect worth knowing: on ₹1,499 at 20% the deposit is ₹300, i.e. 20.01%. The
 * percentage is approximate; the conservation invariant is exact.
 */
export function splitDeposit(total: Decimal, percent: Decimal): DepositSplit {
  const t = total.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

  let balance = t
    .mul(new Decimal(100).minus(percent))
    .div(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);

  // Razorpay would reject a sub-₹1 deposit, leaving a dead order that can never be paid.
  // The clamp lowers the BALANCE rather than raising the deposit, because the balance is
  // the leg that must stay a whole number of rupees — a courier collects it in cash.
  // Flooring here keeps it integral; setting `deposit = 1` instead would have handed the
  // courier a fractional amount on any total with paise in it.
  const maxBalance = t.minus(RAZORPAY_MIN).floor();
  if (balance.gt(maxBalance)) balance = maxBalance;
  if (balance.lt(0)) balance = new Decimal(0);

  // Always a subtraction, never a second rounding, so the two reconstruct the total exactly.
  const deposit = t.minus(balance);

  return { deposit, balance };
}

/**
 * Whether a total can be split at all.
 *
 * Both legs must clear Razorpay's ₹1 floor (the balance because it may later need
 * refunding through the gateway), the deposit must be a genuine part payment rather than
 * the whole order, and the conservation invariant must hold.
 *
 * There is deliberately no business minimum order value — only these technical floors.
 */
export function isPartialSplittable(total: Decimal, percent: Decimal): boolean {
  if (total.lt(RAZORPAY_MIN.mul(2))) return false;

  const { deposit, balance } = splitDeposit(total, percent);
  return (
    deposit.gte(RAZORPAY_MIN) &&
    balance.gte(RAZORPAY_MIN) &&
    deposit.lt(total) &&
    deposit.plus(balance).equals(total)
  );
}

// ── Derived money ───────────────────────────────────────────────────────────────

/**
 * "Paid so far" and "still due" are DERIVED, never stored.
 *
 * Two mutable columns that must always sum to the total are two chances to drift; the
 * frozen split plus the payment status answers both questions without that risk.
 */
export function amountPaid(order: {
  total: unknown;
  paymentPlan: string;
  depositAmount: unknown;
  payment?: { status: string } | null;
}): Decimal {
  const total = new Decimal(order.total!.toString());
  if (order.paymentPlan !== "PARTIAL") return total;
  if (order.payment?.status === "SUCCESS") return total;
  if (order.payment?.status === "PARTIALLY_PAID") {
    return order.depositAmount == null ? new Decimal(0) : new Decimal(order.depositAmount.toString());
  }
  return new Decimal(0);
}

export function amountDue(order: Parameters<typeof amountPaid>[0]): Decimal {
  return new Decimal(order.total!.toString()).sub(amountPaid(order));
}

/**
 * The SQL twin of `amountPaid`, for the raw-SQL reporting queries that cannot call it
 * (admin revenue chart, customer lifetime spend). Assumes `Order o` joined to `Payment p`.
 *
 * Keep in step with `amountPaid` above — an unsettled partial order must contribute only
 * its deposit to revenue, never the full order value.
 */
export const AMOUNT_RECEIVED_SQL = `
  CASE
    WHEN o."paymentPlan" = 'FULL' THEN o.total
    WHEN p.status = 'SUCCESS'     THEN o.total
    WHEN p.status = 'PARTIALLY_PAID' THEN COALESCE(o."depositAmount", 0)
    ELSE 0
  END`;

/**
 * Prisma predicate for "money we have actually received in full".
 *
 * Revenue and P&L must exclude a partial order whose balance is still outstanding —
 * decision 9: revenue lands on settlement, not on the deposit.
 */
export const SETTLED_MONEY_WHERE = {
  OR: [{ paymentPlan: "FULL" as const }, { payment: { status: "SUCCESS" as const } }],
};
