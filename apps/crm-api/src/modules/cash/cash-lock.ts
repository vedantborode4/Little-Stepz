import type { Tx } from "@repo/crm-db/client";
import { fromDbDate } from "../../core/dates";
import { ApiError } from "../../core/http";

/**
 * A closed cash day is a counted, signed-off drawer: nothing may be posted to
 * that account on that date afterwards, or the count would no longer match.
 * Every writer of money (payments, refunds, voids, expenses, transfers) calls
 * this in its transaction. Days without a session aren't locked.
 */
export async function assertCashDaysOpen(tx: Tx, entries: { accountId: string; businessDate: Date }[]) {
  if (entries.length === 0) return;
  const closed = await tx.cashSession.findFirst({
    where: { status: "CLOSED", OR: entries.map((e) => ({ accountId: e.accountId, businessDate: e.businessDate })) },
    include: { account: { select: { name: true } } },
  });
  if (closed) {
    throw new ApiError(
      409,
      "DAY_CLOSED",
      `${closed.account.name} was closed for ${fromDbDate(closed.businessDate)}. Reopen that day to post to it, or use another date.`,
      { accountId: closed.accountId, date: fromDbDate(closed.businessDate) },
    );
  }
}
