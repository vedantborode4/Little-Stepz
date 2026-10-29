import { ApiError } from "./http";

const IST = "Asia/Kolkata";

/** Today's calendar date in IST as YYYY-MM-DD — the business day, whatever the server's zone. */
export function todayIST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(now);
}

/** A YYYY-MM-DD business date as the value Prisma stores in a `@db.Date` column. */
export const toDbDate = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);
export const fromDbDate = (date: Date) => date.toISOString().slice(0, 10);

/** Defaults to today; backdating is allowed (historical entry), future dates are not. */
export function resolveBusinessDate(isoDate: string | undefined): Date {
  const today = todayIST();
  if (isoDate && isoDate > today) {
    throw new ApiError(400, "FUTURE_DATE", "The date can't be in the future", {
      fieldErrors: { businessDate: ["Can't be in the future"] },
    });
  }
  return toDbDate(isoDate ?? today);
}
