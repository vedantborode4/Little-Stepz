import { Prisma, type Tx } from "@repo/crm-db/client";
import { fromDbDate } from "../../core/dates";
import { ApiError } from "../../core/http";

/**
 * A closed cash day is a counted, signed-off drawer: nothing may be posted to
 * that account on that date afterwards, or the count would no longer match.
 * Every writer of money (payments, refunds, voids, expenses, transfers) calls
 * this in its transaction. Days without a session aren't locked.
 *
 * The session rows are share-locked: a day being closed (FOR UPDATE) makes this
 * wait and then see CLOSED, and a close waits for money already being posted,
 * so its expected amount always includes it.
 */
export async function assertCashDaysOpen(tx: Tx, entries: { accountId: string; businessDate: Date }[]) {
  if (entries.length === 0) return;
  const keys = entries.map((e) => Prisma.sql`(${e.accountId}, ${fromDbDate(e.businessDate)}::date)`);
  const sessions = await tx.$queryRaw<{ accountId: string; businessDate: Date; status: string; name: string }[]>`
    SELECT s."accountId", s."businessDate", s.status::text AS status, a.name
    FROM "CashSession" s JOIN "ReceivingAccount" a ON a.id = s."accountId"
    WHERE (s."accountId", s."businessDate") IN (${Prisma.join(keys)})
    ORDER BY s.id
    FOR SHARE OF s`;
  const closed = sessions.find((s) => s.status === "CLOSED");
  if (closed) {
    throw new ApiError(
      409,
      "DAY_CLOSED",
      `${closed.name} was closed for ${fromDbDate(closed.businessDate)}. Reopen that day to post to it, or use another date.`,
      { accountId: closed.accountId, date: fromDbDate(closed.businessDate) },
    );
  }
}
