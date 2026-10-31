import { prisma, Prisma, type Tx } from "@repo/crm-db/client";
import type { CancelSettlementInput, PaymentStatus } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { resolveBusinessDate } from "../../core/dates";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { Decimal, decOrZero, money, round2 } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { assertCashDaysOpen } from "../cash/cash-lock";

/**
 * The only writer of payments, allocations and customer credit. Every rule about
 * money owed and paid lives here; sales and the payments screens call in.
 */

type Db = Tx | typeof prisma;

/** `total` is the order's net value: its grand total less anything returned. */
export function paymentStatus(total: Decimal, paid: Decimal, refunded: boolean): PaymentStatus {
  if (paid.gt(total)) return "OVERPAID";
  if (paid.isZero()) return refunded ? "REFUNDED" : total.isZero() ? "PAID" : "UNPAID";
  return paid.eq(total) ? "PAID" : "PARTIAL";
}

/**
 * Money that went back to the customer and still stands: a refund payment, or
 * value given back as store credit (no payment). A void also leaves a negative
 * allocation (the mirror of a receipt), and a refund can itself be voided;
 * neither of those is a refund.
 */
export const refundPaymentSelect = { reversalOfId: true, reversedBy: { select: { id: true } } } satisfies Prisma.PaymentSelect;
export const isStandingRefund = (a: {
  amount: Prisma.Decimal;
  payment: { reversalOfId: string | null; reversedBy: { id: string } | null } | null;
}) => a.amount.isNegative() && (a.payment === null || (a.payment.reversalOfId === null && a.payment.reversedBy === null));

/** What each order has been paid: the sum of its signed allocations. */
export async function orderPaid(db: Db, orderIds: string[]): Promise<Map<string, Decimal>> {
  const result = new Map(orderIds.map((id) => [id, new Decimal(0)]));
  if (orderIds.length === 0) return result;
  const rows = await db.paymentAllocation.groupBy({ by: ["orderId"], where: { orderId: { in: orderIds } }, _sum: { amount: true } });
  for (const r of rows) result.set(r.orderId, decOrZero(r._sum.amount));
  return result;
}

/** GST-inclusive value returned per order; an order's net value is its total less this. */
export async function orderReturned(db: Db, orderIds: string[]): Promise<Map<string, Decimal>> {
  const result = new Map(orderIds.map((id) => [id, new Decimal(0)]));
  if (orderIds.length === 0) return result;
  const rows = await db.salesReturn.groupBy({ by: ["orderId"], where: { orderId: { in: orderIds } }, _sum: { amount: true } });
  for (const r of rows) result.set(r.orderId, decOrZero(r._sum.amount));
  return result;
}

export async function creditBalance(db: Db, customerId: string): Promise<Decimal> {
  const sum = await db.customerCreditEntry.aggregate({ where: { customerId }, _sum: { amount: true } });
  return decOrZero(sum._sum.amount);
}

/** Order rows are locked (in id order) before money is applied, so two payments can't both fill the same balance. */
async function lockOrders(tx: Tx, ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  if (sorted.length === 0) return new Map<string, LockedOrder>();
  await tx.$queryRaw`SELECT id FROM "SalesOrder" WHERE id IN (${Prisma.join(sorted)}) ORDER BY id FOR UPDATE`;
  const rows = await tx.salesOrder.findMany({
    where: { id: { in: sorted } },
    select: { id: true, code: true, status: true, customerId: true, grandTotal: true },
  });
  const [paid, returned] = await Promise.all([orderPaid(tx, sorted), orderReturned(tx, sorted)]);
  return new Map(rows.map((o) => [o.id, { ...o, total: decOrZero(o.grandTotal).sub(returned.get(o.id)!), paid: paid.get(o.id)! }]));
}

type LockedOrder = { id: string; code: string; status: string; customerId: string | null; total: Decimal; paid: Decimal };

/**
 * The customer row is the lock for spending their credit or using their credit
 * limit. A POS sale takes it before any stock lock, so every path that holds
 * both takes them in the same order.
 */
export async function lockCustomer(tx: Tx, customerId: string) {
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customerId} FOR UPDATE`;
  const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true, mergedIntoId: true, isActive: true } });
  if (!customer) throw notFound("Customer");
  return customer;
}

async function activeAccount(tx: Tx, accountId: string) {
  const account = await tx.receivingAccount.findUnique({ where: { id: accountId } });
  if (!account?.isActive) {
    throw new ApiError(400, "INVALID_ACCOUNT", "Choose an active receiving account", {
      fieldErrors: { accountId: ["Choose an active account"] },
    });
  }
  return account;
}

function assertPayable(order: LockedOrder, amount: Decimal, customerId: string | null) {
  if (order.status === "DRAFT" || order.status === "CANCELLED") {
    throw new ApiError(409, "ORDER_NOT_PAYABLE", `${order.code} is ${order.status.toLowerCase()} and can't take payments`);
  }
  if (order.customerId !== customerId) {
    throw new ApiError(400, "CUSTOMER_MISMATCH", `${order.code} belongs to a different customer`);
  }
  const due = order.total.sub(order.paid);
  if (amount.gt(due)) {
    throw new ApiError(409, "ALLOCATION_EXCEEDS_DUE", `${order.code} has only ${money(due)} due; ${money(amount)} is more than that`, {
      orderCode: order.code,
      due: money(due),
    });
  }
}

export interface ReceiptInput {
  customerId: string | null;
  accountId: string;
  amount: Decimal;
  fee?: Decimal | null;
  reference?: string | null;
  businessDate: Date;
  notes?: string | null;
  allocations: { orderId: string; amount: Decimal }[];
  excessToCredit: boolean;
}

/**
 * Money received. Allocations can't exceed what each order still owes, and any
 * amount left over must be explicitly kept as the customer's credit — it is
 * never silently absorbed. The provider fee defaults to the account's fee %.
 */
export async function recordReceipt(tx: Tx, ctx: RequestContext, input: ReceiptInput) {
  const account = await activeAccount(tx, input.accountId);
  const orders = await lockOrders(
    tx,
    input.allocations.map((a) => a.orderId),
  );
  for (const a of input.allocations) {
    const order = orders.get(a.orderId);
    if (!order) throw new ApiError(400, "INVALID_ORDER", "One of the orders doesn't exist");
    assertPayable(order, a.amount, input.customerId);
    order.paid = order.paid.add(a.amount);
  }

  const allocated = input.allocations.reduce((s, a) => s.add(a.amount), new Decimal(0));
  if (allocated.gt(input.amount)) throw new ApiError(400, "OVER_ALLOCATED", "Allocations add up to more than the payment");
  const excess = input.amount.sub(allocated);
  if (excess.gt(0)) {
    if (!input.customerId) {
      throw new ApiError(400, "UNALLOCATED_EXCESS", `${money(excess)} isn't applied to an order. Walk-in payments must match the sale.`);
    }
    if (!input.excessToCredit) {
      throw new ApiError(
        400,
        "UNALLOCATED_EXCESS",
        `${money(excess)} is more than what's due. Keep it as customer credit, or enter the right amount.`,
        {
          excess: money(excess),
        },
      );
    }
    await lockCustomer(tx, input.customerId);
  }

  const fee = input.fee ?? round2(input.amount.mul(decOrZero(account.feePercent)).div(100));
  if (fee.gt(input.amount))
    throw new ApiError(400, "FEE_TOO_HIGH", "The fee can't exceed the amount", { fieldErrors: { fee: ["More than the amount"] } });

  await assertCashDaysOpen(tx, [{ accountId: account.id, businessDate: input.businessDate }]);
  const payment = await tx.payment.create({
    data: {
      code: await nextCode(tx, "PAY", 5),
      direction: "IN",
      method: account.method,
      accountId: account.id,
      amount: input.amount,
      fee,
      reference: input.reference ?? null,
      businessDate: input.businessDate,
      customerId: input.customerId,
      notes: input.notes ?? null,
      createdById: ctx.userId,
      allocations: { createMany: { data: input.allocations.map((a) => ({ orderId: a.orderId, amount: a.amount })) } },
    },
  });
  if (excess.gt(0)) {
    await tx.customerCreditEntry.create({
      data: { customerId: input.customerId!, type: "OVERPAYMENT", amount: excess, paymentId: payment.id, createdById: ctx.userId },
    });
  }
  await recordAudit(tx, ctx, {
    action: "payment.received",
    entity: "Payment",
    entityId: payment.id,
    after: {
      code: payment.code,
      amount: money(input.amount),
      account: account.name,
      allocations: input.allocations.map((a) => ({ orderId: a.orderId, amount: money(a.amount) })),
      toCredit: money(excess),
    },
  });
  return payment;
}

/** Pays part of an order from the customer's credit. No new money moves. */
export async function applyCredit(tx: Tx, ctx: RequestContext, customerId: string, orderId: string, amount: Decimal) {
  await lockCustomer(tx, customerId);
  const order = (await lockOrders(tx, [orderId])).get(orderId);
  if (!order) throw notFound("Order");
  assertPayable(order, amount, customerId);
  const balance = await creditBalance(tx, customerId);
  if (amount.gt(balance)) {
    throw new ApiError(409, "CREDIT_INSUFFICIENT", `The customer has only ${money(balance)} of credit`, { balance: money(balance) });
  }
  const entry = await tx.customerCreditEntry.create({
    data: { customerId, type: "APPLIED", amount: amount.neg(), orderId, createdById: ctx.userId },
  });
  await tx.paymentAllocation.create({ data: { orderId, creditEntryId: entry.id, amount } });
  await recordAudit(tx, ctx, {
    action: "credit.applied",
    entity: "Customer",
    entityId: customerId,
    after: { order: order.code, amount: money(amount), balanceAfter: money(balance.sub(amount)) },
  });
}

async function outPayment(
  tx: Tx,
  ctx: RequestContext,
  input: {
    accountId: string;
    amount: Decimal;
    customerId: string | null;
    reference?: string | null;
    notes?: string | null;
    businessDate?: Date;
  },
) {
  const account = await activeAccount(tx, input.accountId);
  const businessDate = input.businessDate ?? resolveBusinessDate(undefined);
  await assertCashDaysOpen(tx, [{ accountId: account.id, businessDate }]);
  return tx.payment.create({
    data: {
      code: await nextCode(tx, "PAY", 5),
      direction: "OUT",
      method: account.method,
      accountId: account.id,
      amount: input.amount,
      reference: input.reference ?? null,
      businessDate,
      customerId: input.customerId,
      notes: input.notes ?? null,
      createdById: ctx.userId,
    },
  });
}

/** Pays the customer's credit back to them in money. */
export async function refundCredit(
  tx: Tx,
  ctx: RequestContext,
  customerId: string,
  input: { accountId: string; amount: Decimal; reference?: string | null; notes?: string | null },
) {
  await lockCustomer(tx, customerId);
  const balance = await creditBalance(tx, customerId);
  if (input.amount.gt(balance)) {
    throw new ApiError(409, "CREDIT_INSUFFICIENT", `The customer has only ${money(balance)} of credit`, { balance: money(balance) });
  }
  const payment = await outPayment(tx, ctx, { ...input, customerId });
  await tx.customerCreditEntry.create({
    data: {
      customerId,
      type: "REFUNDED",
      amount: input.amount.neg(),
      paymentId: payment.id,
      note: input.notes ?? null,
      createdById: ctx.userId,
    },
  });
  await recordAudit(tx, ctx, {
    action: "credit.refunded",
    entity: "Customer",
    entityId: customerId,
    after: { payment: payment.code, amount: money(input.amount), balanceAfter: money(balance.sub(input.amount)) },
  });
  return payment;
}

/**
 * Gives money paid on an order back: as a refund payment from an account, or
 * into the customer's credit. Either way a negative allocation takes it off the
 * order, so what the order has been paid stays the sum of its allocations.
 */
export async function giveBack(
  tx: Tx,
  ctx: RequestContext,
  order: { id: string; code: string; customerId: string | null },
  amount: Decimal,
  settlement: CancelSettlementInput,
  creditType: "CANCELLED_ORDER" | "RETURN",
  note: string,
): Promise<{ paymentId: string | null; creditEntryId: string | null }> {
  if (settlement.mode === "CREDIT") {
    if (!order.customerId) throw new ApiError(400, "CUSTOMER_REQUIRED", "A walk-in sale can't hold credit; refund the money instead");
    await lockCustomer(tx, order.customerId);
    const entry = await tx.customerCreditEntry.create({
      data: { customerId: order.customerId, type: creditType, amount, orderId: order.id, note, createdById: ctx.userId },
    });
    await tx.paymentAllocation.create({ data: { orderId: order.id, creditEntryId: entry.id, amount: amount.neg() } });
    return { paymentId: null, creditEntryId: entry.id };
  }
  const payment = await outPayment(tx, ctx, {
    accountId: settlement.accountId,
    amount,
    customerId: order.customerId,
    reference: settlement.reference,
    notes: note,
  });
  await tx.paymentAllocation.create({ data: { orderId: order.id, paymentId: payment.id, amount: amount.neg() } });
  return { paymentId: payment.id, creditEntryId: null };
}

/**
 * Money already paid on an order being cancelled has to go somewhere explicit:
 * back to the customer (a refund payment) or into their credit.
 */
export async function settleCancelledOrder(
  tx: Tx,
  ctx: RequestContext,
  order: { id: string; code: string; customerId: string | null },
  settlement: CancelSettlementInput | undefined,
) {
  const paid = (await orderPaid(tx, [order.id])).get(order.id)!;
  if (paid.lte(0)) return;
  if (!settlement) {
    throw new ApiError(
      409,
      "SETTLEMENT_REQUIRED",
      `${money(paid)} has been paid on ${order.code}. Refund it or keep it as customer credit.`,
      {
        paid: money(paid),
      },
    );
  }
  await giveBack(tx, ctx, order, paid, settlement, "CANCELLED_ORDER", `Refund for cancelled order ${order.code}`);
  await recordAudit(tx, ctx, {
    action: "payment.settled_on_cancel",
    entity: "SalesOrder",
    entityId: order.id,
    after: { code: order.code, amount: money(paid), mode: settlement.mode },
  });
}

/**
 * Undoes a payment recorded by mistake with a mirror row in the other direction:
 * its allocations and credit are reversed too. Refused when that would leave an
 * order paid below zero or credit that has already been spent.
 */
export async function voidPayment(tx: Tx, ctx: RequestContext, paymentId: string, reason: string) {
  await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
  const original = await tx.payment.findUnique({
    where: { id: paymentId },
    include: { allocations: true, creditEntries: true, reversedBy: { select: { code: true } } },
  });
  if (!original) throw notFound("Payment");
  if (original.reversalOfId) throw new ApiError(409, "CANNOT_VOID_REVERSAL", "A reversal can't be voided. Record a new payment instead.");
  if (original.reversedBy) throw new ApiError(409, "ALREADY_VOIDED", `${original.code} was already voided by ${original.reversedBy.code}`);

  const orders = await lockOrders(
    tx,
    original.allocations.map((a) => a.orderId),
  );
  for (const a of original.allocations) {
    const order = orders.get(a.orderId)!;
    const paidAfter = order.paid.sub(decOrZero(a.amount));
    if (order.status === "CANCELLED" || paidAfter.isNegative() || paidAfter.gt(order.total)) {
      throw new ApiError(409, "CANNOT_VOID", `Voiding would leave ${order.code} with an impossible balance; correct it there instead`);
    }
    order.paid = paidAfter;
  }
  if (original.customerId && original.creditEntries.length) {
    await lockCustomer(tx, original.customerId);
    const balance = await creditBalance(tx, original.customerId);
    const change = original.creditEntries.reduce((s, e) => s.sub(decOrZero(e.amount)), new Decimal(0));
    if (balance.add(change).isNegative()) {
      throw new ApiError(409, "CREDIT_ALREADY_USED", "The credit from this payment has already been used, so it can't be voided");
    }
  }

  const today = resolveBusinessDate(undefined);
  await assertCashDaysOpen(tx, [{ accountId: original.accountId, businessDate: today }]);
  const reversal = await tx.payment.create({
    data: {
      code: await nextCode(tx, "PAY", 5),
      direction: original.direction === "IN" ? "OUT" : "IN",
      method: original.method,
      accountId: original.accountId,
      amount: original.amount,
      fee: original.fee,
      reference: original.code,
      businessDate: today,
      customerId: original.customerId,
      notes: reason,
      reversalOfId: original.id,
      createdById: ctx.userId,
      allocations: { createMany: { data: original.allocations.map((a) => ({ orderId: a.orderId, amount: decOrZero(a.amount).neg() })) } },
    },
  });
  for (const e of original.creditEntries) {
    await tx.customerCreditEntry.create({
      data: {
        customerId: e.customerId,
        type: "REVERSAL",
        amount: decOrZero(e.amount).neg(),
        paymentId: reversal.id,
        note: reason,
        createdById: ctx.userId,
      },
    });
  }
  await recordAudit(tx, ctx, {
    action: "payment.voided",
    entity: "Payment",
    entityId: original.id,
    after: { code: original.code, reversal: reversal.code, reason },
  });
  return reversal;
}
