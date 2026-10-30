const IST = "Asia/Kolkata"

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const qty = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })
const dateTime = new Intl.DateTimeFormat("en-IN", { timeZone: IST, dateStyle: "medium", timeStyle: "short" })
const dateOnly = new Intl.DateTimeFormat("en-IN", { timeZone: IST, dateStyle: "medium" })

/**
 * Display only. Amounts arrive as exact decimal strings; converting to a number
 * here is safe for formatting (≤ 14 significant digits) but never do maths on it.
 */
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  return inr.format(Number(value))
}

export function formatQty(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  return qty.format(Number(value))
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : "—"
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateOnly.format(new Date(iso)) : "—"
}

/** Today's date in IST as YYYY-MM-DD (the business day, regardless of the device's zone). */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date())
}

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 })

/** Short rupee figures for chart axes (₹1.2L, ₹45K); never for amounts people act on. */
export function formatMoneyCompact(value: string | number): string {
  return `₹${compact.format(Number(value))}`
}

/** Adds days to a YYYY-MM-DD date (calendar maths, no time zone involved). */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
