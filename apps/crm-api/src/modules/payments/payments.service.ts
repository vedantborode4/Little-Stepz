import type { Tx } from "@repo/crm-db/client";
import type { AccountTransferInput, ApplyCreditInput, ReceivePaymentInput, RefundCreditInput } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { resolveBusinessDate } from "../../core/dates";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { dec, money } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { applyCredit, recordReceipt, refundCredit, voidPayment } from "./ledger";
import { customerCredit, getPayment, getTransfer } from "./payments.queries";

export async function receivePayment(input: ReceivePaymentInput, ctx: RequestContext) {
  const payment = await withTransaction(async (tx) => {
    if (input.customerId) {
      const customer = await tx.customer.findUnique({ where: { id: input.customerId }, select: { mergedIntoId: true } });
      if (!customer || customer.mergedIntoId) throw new ApiError(400, "INVALID_CUSTOMER", "Choose an active customer");
    }
    return recordReceipt(tx, ctx, {
      customerId: input.customerId ?? null,
      accountId: input.accountId,
      amount: dec(input.amount),
      fee: input.fee ? dec(input.fee) : null,
      reference: input.reference,
      businessDate: resolveBusinessDate(input.businessDate),
      notes: input.notes,
      allocations: input.allocations.map((a) => ({ orderId: a.orderId, amount: dec(a.amount) })),
      excessToCredit: input.excessToCredit,
    });
  });
  return getPayment(payment.id);
}

export async function voidPaymentById(id: string, reason: string, ctx: RequestContext) {
  await withTransaction((tx) => voidPayment(tx, ctx, id, reason));
  return getPayment(id);
}

export async function applyCustomerCredit(customerId: string, input: ApplyCreditInput, ctx: RequestContext) {
  await withTransaction((tx) => applyCredit(tx, ctx, customerId, input.orderId, dec(input.amount)));
  return customerCredit(customerId);
}

export async function refundCustomerCredit(customerId: string, input: RefundCreditInput, ctx: RequestContext) {
  await withTransaction((tx) => refundCredit(tx, ctx, customerId, { ...input, amount: dec(input.amount) }));
  return customerCredit(customerId);
}

async function assertTransferAccounts(tx: Tx, ids: string[]) {
  const accounts = await tx.receivingAccount.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
  if (accounts.length !== new Set(ids).size) throw new ApiError(400, "INVALID_ACCOUNT", "Choose two active accounts");
}

/** Moving the business's own money between accounts. Never a sale, a refund or an expense. */
export async function createTransfer(input: AccountTransferInput, ctx: RequestContext) {
  const id = await withTransaction(async (tx) => {
    await assertTransferAccounts(tx, [input.fromAccountId, input.toAccountId]);
    const transfer = await tx.accountTransfer.create({
      data: {
        code: await nextCode(tx, "TRF", 5),
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amount: dec(input.amount),
        businessDate: resolveBusinessDate(input.businessDate),
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, ctx, {
      action: "transfer.created",
      entity: "AccountTransfer",
      entityId: transfer.id,
      after: { code: transfer.code, amount: money(transfer.amount), from: input.fromAccountId, to: input.toAccountId },
    });
    return transfer.id;
  });
  return getTransfer(id);
}

export async function reverseTransfer(id: string, reason: string, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AccountTransfer" WHERE id = ${id} FOR UPDATE`;
    const original = await tx.accountTransfer.findUnique({ where: { id }, include: { reversedBy: { select: { code: true } } } });
    if (!original) throw notFound("Transfer");
    if (original.reversalOfId) throw new ApiError(409, "CANNOT_REVERSE_REVERSAL", "A reversal can't be reversed");
    if (original.reversedBy)
      throw new ApiError(409, "ALREADY_REVERSED", `${original.code} was already reversed by ${original.reversedBy.code}`);
    const reversal = await tx.accountTransfer.create({
      data: {
        code: await nextCode(tx, "TRF", 5),
        fromAccountId: original.toAccountId,
        toAccountId: original.fromAccountId,
        amount: original.amount,
        businessDate: resolveBusinessDate(undefined),
        reference: original.code,
        notes: reason,
        reversalOfId: original.id,
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, ctx, {
      action: "transfer.reversed",
      entity: "AccountTransfer",
      entityId: original.id,
      after: { code: original.code, reversal: reversal.code, reason },
    });
  });
  return getTransfer(id);
}
